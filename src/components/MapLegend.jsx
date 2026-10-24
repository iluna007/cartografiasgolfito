import { Muestra } from './Muestra.jsx'

/**
 * Leyenda: capas visibles (clic para ocultar) y capas apagadas (clic para mostrar).
 */
export function MapLegend({ capas, activas, datos, onToggle, desplazada }) {
  const visibles = capas.filter(c => activas.has(c.id))
  const apagadas = capas.filter(c => !activas.has(c.id))

  return (
    <div id="legend" className={desplazada ? 'legend--desplazada' : ''}>
      <div className="legend-cab">
        <div className="legend-title">Leyenda</div>
      </div>
      {visibles.length === 0 ? (
        <p className="legend-hint">Enciende una capa en el panel para verla aquí.</p>
      ) : (
        <>
          <p className="legend-hint">Clic para ocultar capa</p>
          <div id="legend-items">
            {visibles.map(c => (
              <div
                key={c.id}
                className="legend-item"
                role="button"
                tabIndex={0}
                onClick={() => onToggle(c.id)}
                onKeyDown={e => e.key === 'Enter' && onToggle(c.id)}
              >
                <Muestra capa={c} />
                <span className="legend-label">{c.titulo}</span>
                <span className="legend-count">{datos[c.id] ? datos[c.id].n : '…'}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {apagadas.length > 0 && (
        <div id="legend-hidden" className="legend-hidden">
          <div className="legend-hidden-label">Apagadas · clic para mostrar</div>
          {apagadas.map(c => (
            <button key={c.id} type="button" className="legend-chip" onClick={() => onToggle(c.id)}>
              <span className="legend-chip-dot" style={{ background: `rgb(${c.color[0]},${c.color[1]},${c.color[2]})` }} />
              {c.titulo}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
