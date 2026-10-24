import fuente from '../data/fuente.json'

/**
 * Configuración del mapa.
 *
 * El token NO va en el repo. Dev: .env.local -> VITE_MAPBOX_TOKEN=pk.eyJ...
 * Netlify: Site configuration -> Environment variables -> VITE_MAPBOX_TOKEN
 */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN?.trim() || ''

export const MAPBOX_STYLE =
  import.meta.env.VITE_MAPBOX_STYLE?.trim() ||
  'mapbox://styles/ikerluna/cmmp9964u005401rzhlycalmk'

/**
 * Hoja de Google Sheets que hace de CMS de capas.
 * VITE_CAPAS_SHEET_ID=otro-id cambia de hoja; VITE_CAPAS_SHEET_ID=local fuerza la copia local de public/capas/.
 */
const idEnv = import.meta.env.VITE_CAPAS_SHEET_ID?.trim()
export const SHEET_ID = idEnv === 'local' ? '' : (idEnv || fuente.sheetId || '')

export const BASE_CAPAS = `${import.meta.env.BASE_URL}capas/`

export function isMapboxTokenConfigured() {
  const t = MAPBOX_TOKEN
  return Boolean(t) && !t.includes('XXXXXXXX') && t !== 'TU_TOKEN_AQUI'
}
