/**
 * Listado de capas (CMS en Google Sheets) y carga de sus GeoJSON.
 *
 * El listado vive en una hoja con tres pestañas: Capas, Grupos y Config.
 * Si la hoja no es pública o no hay red, se usa la copia local de public/capas/*.csv
 * (se actualiza con `npm run sync:capas`).
 */
import { SHEET_ID, BASE_CAPAS } from '../lib/config.js'
import { filasComoObjetos } from '../lib/csv.js'
import { normalizarGeoJSON } from '../lib/crs.js'

const HOJAS = [
  ['Capas', 'capas.csv'],
  ['Grupos', 'grupos.csv'],
  ['Config', 'config.csv'],
]

const TIPOS = { linea: 'linea', punto: 'punto', triangulo: 'triangulo', poligono: 'poligono' }

const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const bool = (v, defecto = false) => (v === '' || v == null ? defecto : /^(true|1|si|x|yes|verdadero)$/i.test(sinTildes(String(v).trim())))
const num = (v, defecto = null) => {
  if (v === '' || v == null) return defecto
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : defecto
}

/** "#rgb" | "#rrggbb" | "#rrggbbaa" -> [r, g, b, a] */
export function hexARgba(hex, alfaPorDefecto = 255) {
  if (!hex) return null
  let h = String(hex).trim().replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : alfaPorDefecto
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a]
}

async function pedirTexto(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  const texto = await r.text()
  if (/^\s*</.test(texto)) throw new Error(`${url}: la respuesta no es CSV (¿hoja privada?)`)
  return texto
}

async function leerTablas() {
  if (SHEET_ID) {
    try {
      const textos = await Promise.all(HOJAS.map(([hoja]) =>
        pedirTexto(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(hoja)}`)))
      return { origen: 'hoja', textos }
    } catch (err) {
      console.warn('No se pudo leer la hoja de Google Sheets, uso la copia local.', err.message)
    }
  }
  const textos = await Promise.all(HOJAS.map(([, archivo]) => pedirTexto(`${BASE_CAPAS}${archivo}`)))
  return { origen: 'local', textos }
}

function parseCapa(f) {
  const tipo = TIPOS[sinTildes((f.tipo || '').toLowerCase().trim())]
  if (!f.id || !f.archivo || !tipo) {
    console.warn(`Capa omitida (revisa id, archivo y tipo):`, f)
    return null
  }
  const defectos = {
    linea: { color: [247, 181, 0, 255], ancho: 2, radio: null },
    punto: { color: [255, 255, 255, 255], ancho: 1, radio: 5 },
    triangulo: { color: [96, 165, 250, 255], ancho: 1, radio: 8 },
    poligono: { color: [229, 72, 77, 255], ancho: 1, radio: null },
  }[tipo]
  const alfa = tipo === 'poligono' ? 150 : 255
  const color = hexARgba(f.color, alfa) || (tipo === 'poligono' ? [...defectos.color.slice(0, 3), alfa] : defectos.color)
  let borde = hexARgba(f.borde)
  if (!borde) {
    if (tipo === 'poligono') borde = [color[0], color[1], color[2], 255]
    else if (tipo === 'punto' || tipo === 'triangulo') borde = [20, 20, 24, 255]
  }
  return {
    id: f.id.trim(),
    activa: bool(f.activa, true),
    orden: num(f.orden, 999),
    grupo: f.grupo || 'otros',
    titulo: f.titulo || f.id,
    descripcion: f.descripcion || '',
    archivo: f.archivo.trim(),
    tipo,
    color,
    borde,
    ancho: num(f.ancho, defectos.ancho),
    radio: num(f.radio, defectos.radio),
    punteada: tipo === 'linea' && bool(f.punteada),
    visibleInicial: bool(f.visible_inicial),
    campoNombre: f.campo_nombre || '',
    camposInfo: (f.campos_info || '').split(',').map(s => s.trim()).filter(Boolean),
    creditos: f.creditos || '',
    crs: f.crs || '',
  }
}

export async function cargarManifiesto() {
  const { origen, textos } = await leerTablas()
  const [filasCapas, filasGrupos, filasConfig] = textos.map(filasComoObjetos)

  const config = Object.fromEntries(filasConfig.filter(f => f.clave).map(f => [f.clave, f.valor]))

  const grupos = filasGrupos
    .filter(g => g.id)
    .map(g => ({ id: g.id, orden: num(g.orden, 999), titulo: g.titulo || g.id, plegado: bool(g.plegado), descripcion: g.descripcion || '' }))
    .sort((a, b) => a.orden - b.orden)

  const capas = filasCapas.map(parseCapa).filter(c => c && c.activa)

  // Capas con un grupo que no existe: van a "Otras capas" en vez de perderse
  for (const c of capas) {
    if (!grupos.some(g => g.id === c.grupo)) {
      c.grupo = 'otros'
      if (!grupos.some(g => g.id === 'otros')) grupos.push({ id: 'otros', orden: 9999, titulo: 'Otras capas', plegado: false, descripcion: '' })
    }
  }
  const ordenGrupo = Object.fromEntries(grupos.map((g, i) => [g.id, i]))
  capas.sort((a, b) => ordenGrupo[a.grupo] - ordenGrupo[b.grupo] || a.orden - b.orden)

  return { origen, config, grupos, capas }
}

const cache = new Map()

/** Descarga y normaliza (a lon/lat) el GeoJSON de una capa. Solo se pide al encenderla. */
export function cargarDatosCapa(capa) {
  if (!cache.has(capa.id)) {
    const url = /^https?:\/\//i.test(capa.archivo) ? capa.archivo : `${BASE_CAPAS}${capa.archivo.replace(/^\/+/, '')}`
    const p = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`${capa.archivo}: ${r.status}`)
        return r.json()
      })
      .then(json => normalizarGeoJSON(json, { epsg: capa.crs }))
    p.catch(() => cache.delete(capa.id))
    cache.set(capa.id, p)
  }
  return cache.get(capa.id)
}
