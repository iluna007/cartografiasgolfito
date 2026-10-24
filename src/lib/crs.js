import proj4 from 'proj4'

/**
 * Normaliza un GeoJSON exportado de QGIS a WGS84 (lon/lat) para el mapa.
 * QGIS suele exportar en el CRS del proyecto (por ejemplo EPSG:8908, CRTM05, en metros),
 * y declara ese CRS en el campo "crs" del archivo.
 */
const CRTM05 = '+proj=tmerc +lat_0=0 +lon_0=-84 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'

const DEFINICIONES = {
  5367: CRTM05, // CR05 / CRTM05
  8908: CRTM05, // CR-SIRGAS / CRTM05
  9377: '+proj=tmerc +lat_0=4 +lon_0=-73 +k=0.9992 +x_0=5000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs', // MAGNA-SIRGAS origen nacional
}
// UTM WGS84 norte (326xx) y sur (327xx), zonas 10 a 20
for (let z = 10; z <= 20; z++) {
  DEFINICIONES[32600 + z] = `+proj=utm +zone=${z} +datum=WGS84 +units=m +no_defs`
  DEFINICIONES[32700 + z] = `+proj=utm +zone=${z} +south +datum=WGS84 +units=m +no_defs`
}
for (const [codigo, def] of Object.entries(DEFINICIONES)) proj4.defs(`EPSG:${codigo}`, def)

/** Sistemas geográficos que se tratan como lon/lat sin transformar (diferencias de datum menores a 2 m) */
const GEOGRAFICOS = new Set([4326, 4258, 4269, 4170, 4674, 5365, 8907])

export function detectarEpsg(geojson, forzado) {
  if (forzado) {
    const n = Number(String(forzado).replace(/\D/g, ''))
    return n || null
  }
  const nombre = geojson?.crs?.properties?.name
  if (!nombre) return null
  if (/CRS84/i.test(nombre)) return 4326
  const m = String(nombre).match(/(\d{4,6})\s*$/)
  return m ? Number(m[1]) : null
}

function primeraCoordenada(c) {
  if (!Array.isArray(c)) return null
  if (typeof c[0] === 'number') return c
  for (const x of c) {
    const r = primeraCoordenada(x)
    if (r) return r
  }
  return null
}

function mapearCoordenadas(c, fn) {
  return typeof c[0] === 'number' ? fn(c) : c.map(x => mapearCoordenadas(x, fn))
}

function mapearGeometria(g, fn) {
  if (!g) return null
  if (g.type === 'GeometryCollection') return { ...g, geometries: g.geometries.map(x => mapearGeometria(x, fn)) }
  return { ...g, coordinates: mapearCoordenadas(g.coordinates, fn) }
}

function ampliar(bb, [x, y]) {
  if (x < bb[0]) bb[0] = x
  if (y < bb[1]) bb[1] = y
  if (x > bb[2]) bb[2] = x
  if (y > bb[3]) bb[3] = y
}

/**
 * @param geojson FeatureCollection | Feature | Geometry
 * @param opciones.epsg  fuerza el CRS cuando el archivo no lo declara
 * @returns { fc, bbox: [minLon, minLat, maxLon, maxLat] | null, n }
 */
export function normalizarGeoJSON(geojson, { epsg } = {}) {
  const fc = geojson?.type === 'FeatureCollection'
    ? geojson
    : { type: 'FeatureCollection', features: [geojson?.type === 'Feature' ? geojson : { type: 'Feature', properties: {}, geometry: geojson }] }

  const codigo = detectarEpsg(geojson, epsg)
  let convertir = c => [c[0], c[1]]

  if (codigo && !GEOGRAFICOS.has(codigo)) {
    if (!proj4.defs(`EPSG:${codigo}`)) {
      throw new Error(`CRS EPSG:${codigo} no soportado. Exporta la capa en EPSG:4326 o agrega la definición en src/lib/crs.js.`)
    }
    const t = proj4(`EPSG:${codigo}`, 'EPSG:4326')
    convertir = c => t.forward([c[0], c[1]])
  } else if (!codigo) {
    const c = primeraCoordenada(fc.features.find(f => f.geometry)?.geometry?.coordinates)
    if (c && (Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90)) {
      throw new Error('Las coordenadas están en metros y el archivo no declara su CRS. Indica el código EPSG en la columna crs de la hoja.')
    }
  }

  const redondear = n => Math.round(n * 1e6) / 1e6
  const bbox = [Infinity, Infinity, -Infinity, -Infinity]
  const fn = c => {
    const [x, y] = convertir(c)
    const p = [redondear(x), redondear(y)]
    ampliar(bbox, p)
    return p
  }

  const features = fc.features
    .filter(f => f?.geometry)
    .map(f => ({ type: 'Feature', properties: f.properties || {}, geometry: mapearGeometria(f.geometry, fn) }))

  return {
    fc: { type: 'FeatureCollection', features },
    bbox: Number.isFinite(bbox[0]) ? bbox : null,
    n: features.length,
  }
}
