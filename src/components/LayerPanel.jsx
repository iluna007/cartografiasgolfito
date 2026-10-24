import { useState } from 'react'
import { Muestra } from './Muestra.jsx'

/**
 * Panel de capas: grupos plegables con casillas, simbología y "Ir a la capa".
 * El listado sale del CMS (Google Sheets), no está escrito en el código.
 */
export function LayerPanel({ abierto, onCerrar, manifiesto, activas, estados, onToggle, onGrupo, onIr }) {
  const [cerrados, setCerrados] = useState({})
  if (!abierto || !manifiesto) return null

  const { config, grupos, capas } = manifiesto
  const estaPlegado = g => (g.id in cerrados ? cerrados[g.id] : g.plegado)

  return (
    <aside id="capas-panel" aria-label="Capas del mapa">
      <header className="capas__cab">
        <div>
          <h2>{config.panel_titulo || 'Capas'}</h2>
          {config.panel_subtitulo && <p>{config.panel_subtitulo}</p>}
        </div>
        <button type="button" className="capas__cerrar" onClick={onCerrar} aria-label="Cerrar panel">×</button>
      </header>

      {grupos.map(grupo => {
        const delGrupo = capas.filter(c => c.grupo === grupo.id)
        if (!delGrupo.length) return null
        const encendidas = delGrupo.filter(c => activas.has(c.id)).length
        const plegado = estaPlegado(grupo)
        return (
          <section className="capas__sec" key={grupo.id}>
            <div className="capas__sec-cab">
              <button
                type="button"
                className="capas__plegar"
                aria-expanded={!plegado}
                aria-controls={`capas-grupo-${grupo.id}`}
                onClick={() => setCerrados(c => ({ ...c, [grupo.id]: !plegado }))}
              >
                <span className="capas__flecha" aria-hidden="true">{plegado ? '▸' : '▾'}</span>
                <h3>{grupo.titulo}</h3>
                <span className="capas__cuenta">{encendidas}/{delGrupo.length}</span>
              </button>
              {!plegado && (
                <button type="button" onClick={() => onGrupo(delGrupo.map(c => c.id), encendidas < delGrupo.length)}>
                  {encendidas < delGrupo.length ? 'Todas' : 'Ninguna'}
                </button>
              )}
            </div>
            {!plegado && (
              <ul className="capas__lista" id={`capas-grupo-${grupo.id}`}>
                {delGrupo.map(c => {
                  const estado = estados[c.id] || {}
                  return (
                    <li key={c.id}>
                      <label title={c.descripcion || undefined}>
                        <input type="checkbox" checked={activas.has(c.id)} onChange={() => onToggle(c.id)} />
                        <Muestra capa={c} />
                        <span className="capas__nombre">{c.titulo}</span>
                      </label>
                      <button type="button" className="capas__ir" onClick={() => onIr(c.id)} title="Encuadrar esta capa">
                        Ir
                      </button>
                      {estado.cargando && <span className="capas__estado">cargando…</span>}
                      {estado.error && <span className="capas__estado capas__estado--error" title={estado.error}>error</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}

      {config.creditos && (
        <footer className="capas__pie">
          <p>{config.creditos}</p>
        </footer>
      )}
    </aside>
  )
}
