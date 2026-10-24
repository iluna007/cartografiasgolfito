import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { MAPBOX_TOKEN, MAPBOX_STYLE, isMapboxTokenConfigured } from '../lib/config.js'
import { cargarManifiesto, cargarDatosCapa } from '../data/capas.js'
import { crearCapasDeck, nombreDeFeature } from '../map/layers.js'

const ZOOM_ETIQUETAS = 10
const VISTA_DEFECTO = { lng: -84, lat: 9.9, zoom: 7 }

const bool = (v, defecto) => (v === undefined || v === '' ? defecto : /^(true|1|si|x)$/i.test(String(v).trim()))
const numero = (v, defecto) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return v === undefined || v === '' || !Number.isFinite(n) ? defecto : n
}

function unirBounds(lista) {
  const validas = lista.filter(Boolean)
  if (!validas.length) return null
  return [
    [Math.min(...validas.map(b => b[0])), Math.min(...validas.map(b => b[1]))],
    [Math.max(...validas.map(b => b[2])), Math.max(...validas.map(b => b[3]))],
  ]
}

/**
 * Motor del mapa: carga el listado de capas (Google Sheets), crea el mapa Mapbox con el overlay deck.gl
 * y descarga cada GeoJSON solo cuando se enciende la capa.
 * @param getPadding función que devuelve el padding de fitBounds (depende de qué paneles están abiertos)
 */
export function useMap(contenedorRef, getPadding) {
  const [manifiesto, setManifiesto] = useState(null)
  const [errorManifiesto, setErrorManifiesto] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [activas, setActivas] = useState(() => new Set())
  const [datos, setDatos] = useState({})
  const [errores, setErrores] = useState({}) // id -> mensaje de error de carga
  const [etiquetas, setEtiquetas] = useState(true)
  const [zoomEtiquetas, setZoomEtiquetas] = useState(false)
  const [tooltip, setTooltip] = useState(null)
  const [seleccion, setSeleccion] = useState(null)

  const engineRef = useRef({ map: null, overlay: null })
  const pedidas = useRef(new Set())
  const ajustado = useRef(false)
  const paddingRef = useRef(getPadding)
  useEffect(() => { paddingRef.current = getPadding })

  const configError = manifiesto && !isMapboxTokenConfigured() ? 'mapbox' : null

  // 1. Listado de capas
  useEffect(() => {
    let vivo = true
    cargarManifiesto()
      .then(m => {
        if (!vivo) return
        setManifiesto(m)
        setActivas(new Set(m.capas.filter(c => c.visibleInicial).map(c => c.id)))
      })
      .catch(err => {
        console.error(err)
        if (vivo) setErrorManifiesto('No se pudo cargar el listado de capas.')
      })
    return () => { vivo = false }
  }, [])

  // 2. Mapa Mapbox + overlay deck.gl (cuando ya conocemos la configuración)
  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!manifiesto || !contenedor) return undefined
    if (!isMapboxTokenConfigured()) return undefined
    mapboxgl.accessToken = MAPBOX_TOKEN
    const cfg = manifiesto.config

    const map = new mapboxgl.Map({
      container: contenedor,
      style: cfg.estilo_mapbox || MAPBOX_STYLE,
      center: [numero(cfg.centro_lng, VISTA_DEFECTO.lng), numero(cfg.centro_lat, VISTA_DEFECTO.lat)],
      zoom: numero(cfg.zoom, VISTA_DEFECTO.zoom),
      minZoom: 2,
      projection: 'mercator',
    })
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    const overlay = new MapboxOverlay({
      layers: [],
      pickingRadius: 6,
      getCursor: ({ isHovering, isDragging }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'),
    })
    map.addControl(overlay)
    engineRef.current = { map, overlay }

    map.on('zoom', () => {
      const on = map.getZoom() >= ZOOM_ETIQUETAS
      setZoomEtiquetas(prev => (prev === on ? prev : on))
    })
    map.on('load', () => setMapReady(true))

    return () => {
      map.remove()
      engineRef.current = { map: null, overlay: null }
      setMapReady(false)
    }
  }, [manifiesto, contenedorRef])

  // 3. Los GeoJSON se descargan solo al encender la capa
  useEffect(() => {
    if (!manifiesto) return
    for (const id of activas) {
      if (pedidas.current.has(id)) continue
      const capa = manifiesto.capas.find(c => c.id === id)
      if (!capa) continue
      pedidas.current.add(id)
      cargarDatosCapa(capa)
        .then(res => {
          setErrores(prev => (id in prev ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)) : prev))
          setDatos(prev => ({ ...prev, [id]: res }))
        })
        .catch(err => {
          console.error(`Capa ${id}`, err)
          pedidas.current.delete(id)
          setErrores(prev => ({ ...prev, [id]: err.message }))
        })
    }
  }, [activas, manifiesto])

  // Estado de carga de cada capa encendida: cargando, con error o lista
  const estados = useMemo(() => {
    const out = {}
    for (const id of activas) {
      if (datos[id]) out[id] = {}
      else if (errores[id]) out[id] = { error: errores[id] }
      else out[id] = { cargando: true }
    }
    return out
  }, [activas, datos, errores])

  const onHover = useCallback((info, capa) => {
    const { object, x, y } = info
    const feature = object?.feature ?? object
    if (!feature) {
      setTooltip(null)
      return
    }
    setTooltip({ x: x + 12, y: y - 10, tipo: capa.titulo, titulo: nombreDeFeature(capa, feature) || capa.titulo })
  }, [])

  const onClick = useCallback((feature, capa) => {
    setSeleccion({ capa, feature })
  }, [])

  // 4. Pinta las capas en deck.gl
  useEffect(() => {
    const { overlay } = engineRef.current
    if (!mapReady || !overlay || !manifiesto) return
    overlay.setProps({
      layers: crearCapasDeck({
        capas: manifiesto.capas,
        activas,
        datos,
        etiquetas: etiquetas && zoomEtiquetas,
        seleccion,
        onHover,
        onClick,
      }),
    })
  }, [mapReady, manifiesto, activas, datos, etiquetas, zoomEtiquetas, seleccion, onHover, onClick])

  const encuadrar = useCallback((bounds, opciones = {}) => {
    const { map } = engineRef.current
    if (!map || !bounds) return
    map.fitBounds(bounds, { padding: paddingRef.current(), maxZoom: 15, duration: 900, essential: true, ...opciones })
  }, [])

  // 5. Encuadre inicial sobre las capas que arrancan encendidas
  useEffect(() => {
    if (!mapReady || !manifiesto || ajustado.current) return
    const iniciales = manifiesto.capas.filter(c => c.visibleInicial).map(c => c.id)
    if (iniciales.length && !iniciales.every(id => datos[id] || estados[id]?.error)) return
    ajustado.current = true
    if (!bool(manifiesto.config.ajustar_a_capas, true)) return
    encuadrar(unirBounds(iniciales.map(id => datos[id]?.bbox)), { duration: 0 })
  }, [mapReady, manifiesto, datos, estados, encuadrar])

  const toggleCapa = useCallback(id => {
    setActivas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSeleccion(s => (s?.capa.id === id ? null : s))
  }, [])

  const setGrupo = useCallback((ids, valor) => {
    setActivas(prev => {
      const next = new Set(prev)
      ids.forEach(id => (valor ? next.add(id) : next.delete(id)))
      return next
    })
    if (!valor) setSeleccion(s => (s && ids.includes(s.capa.id) ? null : s))
  }, [])

  /** Enciende la capa y encuadra su extensión */
  const irACapa = useCallback(async id => {
    const capa = manifiesto?.capas.find(c => c.id === id)
    if (!capa) return
    setActivas(prev => (prev.has(id) ? prev : new Set(prev).add(id)))
    try {
      const res = await cargarDatosCapa(capa)
      encuadrar(res.bbox)
    } catch {
      // el error de carga ya queda reflejado en `estados`
    }
  }, [manifiesto, encuadrar])

  const verTodo = useCallback(() => {
    encuadrar(unirBounds([...activas].map(id => datos[id]?.bbox)))
  }, [activas, datos, encuadrar])

  return {
    manifiesto,
    errorManifiesto,
    configError,
    mapReady,
    activas,
    datos,
    estados,
    etiquetas,
    setEtiquetas,
    tooltip,
    seleccion,
    setSeleccion,
    toggleCapa,
    setGrupo,
    irACapa,
    verTodo,
  }
}
