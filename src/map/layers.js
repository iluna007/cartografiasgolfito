/**
 * Capas deck.gl a partir del manifiesto: línea, punto, triángulo y polígono.
 */
import { GeoJsonLayer, IconLayer, TextLayer } from '@deck.gl/layers'
import { PathStyleExtension } from '@deck.gl/extensions'

const DASH = [new PathStyleExtension({ dash: true })]

const TRIANGULO = `data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><polygon points='32,5 61,57 3,57' fill='black'/></svg>",
)}`
const ICONO_TRIANGULO = { url: TRIANGULO, width: 64, height: 64, mask: true }

export function nombreDeFeature(capa, feature) {
  const v = capa.campoNombre ? feature?.properties?.[capa.campoNombre] : null
  return v != null && v !== '' ? String(v) : null
}

const cachePuntos = new WeakMap()
/** Puntos de un FeatureCollection como [{ position, feature }] (para triángulos y etiquetas) */
function puntosDe(fc) {
  if (!cachePuntos.has(fc)) {
    const out = []
    for (const feature of fc.features) {
      const g = feature.geometry
      if (g.type === 'Point') out.push({ position: g.coordinates, feature })
      else if (g.type === 'MultiPoint') g.coordinates.forEach(position => out.push({ position, feature }))
    }
    cachePuntos.set(fc, out)
  }
  return cachePuntos.get(fc)
}

function capasDeUna(capa, fc, { onHover, onClick }) {
  const hover = info => onHover(info, capa)
  const click = info => info.object && onClick(info.object.feature ?? info.object, capa)
  const interaccion = {
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 90],
    onHover: hover,
    onClick: click,
  }

  if (capa.tipo === 'linea') {
    const base = { data: fc, filled: false, stroked: true, lineWidthUnits: 'pixels', lineCapRounded: true, lineJointRounded: true }
    const capas = []
    if (capa.borde) {
      capas.push(new GeoJsonLayer({
        ...base,
        id: `${capa.id}-borde`,
        getLineColor: capa.borde,
        getLineWidth: capa.ancho + 3,
        lineWidthMinPixels: capa.ancho + 2,
        pickable: false,
      }))
    }
    capas.push(new GeoJsonLayer({
      ...base,
      ...interaccion,
      id: capa.id,
      getLineColor: capa.color,
      getLineWidth: capa.ancho,
      lineWidthMinPixels: 0.8,
      ...(capa.punteada ? { extensions: DASH, getDashArray: [3.2, 2], dashJustified: true } : {}),
    }))
    return capas
  }

  if (capa.tipo === 'poligono') {
    return [new GeoJsonLayer({
      ...interaccion,
      id: capa.id,
      data: fc,
      filled: true,
      stroked: true,
      getFillColor: capa.color,
      getLineColor: capa.borde,
      getLineWidth: capa.ancho,
      lineWidthUnits: 'pixels',
    })]
  }

  if (capa.tipo === 'triangulo') {
    const data = puntosDe(fc)
    const base = {
      data,
      getPosition: d => d.position,
      getIcon: () => ICONO_TRIANGULO,
      sizeUnits: 'pixels',
      billboard: true,
    }
    return [
      new IconLayer({ ...base, id: `${capa.id}-borde`, getSize: capa.radio * 2 + 4, getColor: capa.borde, pickable: false }),
      new IconLayer({ ...base, ...interaccion, id: capa.id, getSize: capa.radio * 2, getColor: capa.color }),
    ]
  }

  return [new GeoJsonLayer({
    ...interaccion,
    id: capa.id,
    data: fc,
    pointType: 'circle',
    filled: true,
    stroked: true,
    pointRadiusUnits: 'pixels',
    getPointRadius: capa.radio,
    getFillColor: capa.color,
    getLineColor: capa.borde,
    getLineWidth: capa.ancho,
    lineWidthUnits: 'pixels',
  })]
}

const cacheEtiquetas = new Map()
function etiquetasDe(capa, fc) {
  const previo = cacheEtiquetas.get(capa.id)
  if (previo?.fc === fc) return previo.data
  const data = puntosDe(fc)
    .map(p => ({ position: p.position, texto: nombreDeFeature(capa, p.feature) }))
    .filter(p => p.texto)
  cacheEtiquetas.set(capa.id, { fc, data })
  return data
}

function capaSeleccion({ capa, feature }) {
  const fc = { type: 'FeatureCollection', features: [feature] }
  const blanco = [255, 255, 255, 235]
  if (capa.tipo === 'triangulo') {
    return new GeoJsonLayer({
      id: 'seleccion', data: fc, pointType: 'circle', filled: false, stroked: true, pickable: false,
      pointRadiusUnits: 'pixels', getPointRadius: capa.radio + 5, getLineColor: blanco, getLineWidth: 2, lineWidthUnits: 'pixels',
    })
  }
  return new GeoJsonLayer({
    id: 'seleccion', data: fc, filled: false, stroked: true, pickable: false,
    pointType: 'circle', pointRadiusUnits: 'pixels', getPointRadius: (capa.radio || 4) + 4,
    getLineColor: capa.tipo === 'linea' ? [255, 255, 255, 70] : blanco,
    getLineWidth: capa.tipo === 'linea' ? capa.ancho + 6 : 2,
    lineWidthUnits: 'pixels', lineCapRounded: true, lineJointRounded: true,
  })
}

/**
 * @param capas      capas del manifiesto, ya ordenadas: las últimas se dibujan encima
 * @param activas    Set de ids visibles
 * @param datos      { [id]: { fc } } GeoJSON ya cargados
 * @param etiquetas  mostrar nombres de puntos
 * @param seleccion  { capa, feature } | null
 */
export function crearCapasDeck({ capas, activas, datos, etiquetas, seleccion, onHover, onClick }) {
  const out = []
  for (const capa of capas) {
    const d = datos[capa.id]
    if (activas.has(capa.id) && d) out.push(...capasDeUna(capa, d.fc, { onHover, onClick }))
  }
  if (etiquetas) {
    for (const capa of capas) {
      const d = datos[capa.id]
      if (!activas.has(capa.id) || !d || !capa.campoNombre || !['punto', 'triangulo'].includes(capa.tipo)) continue
      out.push(new TextLayer({
        id: `${capa.id}-etiquetas`,
        data: etiquetasDe(capa, d.fc),
        pickable: false,
        getPosition: p => p.position,
        getText: p => p.texto,
        getSize: 11,
        getColor: [255, 255, 255, 200],
        getPixelOffset: [0, -(capa.radio || 5) - 10],
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 500,
        background: true,
        getBackgroundColor: [0, 0, 0, 140],
        backgroundPadding: [4, 2],
        characterSet: 'auto',
      }))
    }
  }
  if (seleccion && activas.has(seleccion.capa.id)) out.push(capaSeleccion(seleccion))
  return out
}
