import { Muestra } from './Muestra.jsx'

/**
 * Leyenda de todas las capas. Al apagar una, la fila se queda y solo cambia de estilo.
 */
export function MapLegend({ capas, activas, datos, onToggle, desplazada }) {
  return (
    <div id="legend" className={desplazada ? 'legend--desplazada' : ''}>
      <div className="legend-cab">
        <div className="legend-title">Leyenda</div>
      </div>
      <div id="legend-items">
        {capas.map(c => {
          const encendida = activas.has(c.id)
          return (
            <div
              key={c.id}
              className={`legend-item${encendida ? '' : ' legend-item--apagada'}`}
              role="button"
              tabIndex={0}
              aria-pressed={encendida}
              onClick={() => onToggle(c.id)}
              onKeyDown={e => e.key === 'Enter' && onToggle(c.id)}
            >
              <Muestra capa={c} />
              <span className="legend-label">{c.titulo}</span>
              <span className="legend-count">{datos[c.id] ? datos[c.id].n : '…'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
