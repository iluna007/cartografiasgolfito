const css = c => (c ? `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})` : 'transparent')

/** Muestra del símbolo de una capa (la misma que se dibuja en el mapa) */
export function Muestra({ capa }) {
  return (
    <i
      className={`muestra muestra--${capa.tipo}${capa.punteada ? ' muestra--punteada' : ''}`}
      style={{ '--c': css(capa.color), '--b': css(capa.borde) }}
      aria-hidden="true"
    />
  )
}
