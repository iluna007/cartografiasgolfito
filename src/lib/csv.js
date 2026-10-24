/** Parser CSV mínimo (RFC 4180): comillas, comas y saltos de línea dentro de celdas. */
export function parseCsv(texto) {
  const filas = []
  let fila = []
  let celda = ''
  let comillas = false
  const s = texto.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (comillas) {
      if (ch === '"') {
        if (s[i + 1] === '"') { celda += '"'; i++ } else comillas = false
      } else celda += ch
    } else if (ch === '"') comillas = true
    else if (ch === ',') { fila.push(celda); celda = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      fila.push(celda); celda = ''
      filas.push(fila); fila = []
    } else celda += ch
  }
  if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila) }
  return filas
}

/** Primera fila = encabezados. Devuelve objetos y descarta filas totalmente vacías. */
export function filasComoObjetos(texto) {
  const [cab, ...resto] = parseCsv(texto)
  if (!cab) return []
  const claves = cab.map(c => c.trim())
  return resto
    .filter(f => f.some(c => c.trim() !== ''))
    .map(f => Object.fromEntries(claves.map((k, i) => [k, (f[i] ?? '').trim()])))
}
