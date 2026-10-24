// Descarga las pestañas Capas, Grupos y Config del CMS (Google Sheets) a public/capas/*.csv.
// Sirve como copia local de respaldo: el sitio la usa si la hoja no es pública o no hay red.
//   npm run sync:capas
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fuente = JSON.parse(readFileSync(new URL('../src/data/fuente.json', import.meta.url), 'utf8'))
const id = process.env.VITE_CAPAS_SHEET_ID || fuente.sheetId
const destino = fileURLToPath(new URL('../public/capas/', import.meta.url))

for (const [hoja, archivo] of [['Capas', 'capas.csv'], ['Grupos', 'grupos.csv'], ['Config', 'config.csv']]) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(hoja)}`
  const r = await fetch(url)
  const texto = await r.text()
  if (!r.ok || /^\s*</.test(texto)) {
    console.error(`No se pudo leer la pestaña "${hoja}". ¿La hoja está compartida como "Cualquier persona con el enlace: Lector"?`)
    process.exit(1)
  }
  writeFileSync(destino + archivo, texto)
  console.log(`${hoja} -> public/capas/${archivo}`)
}
