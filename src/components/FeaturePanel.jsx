import { nombreDeFeature } from '../map/layers.js'

const esVacio = v => v === null || v === undefined || v === ''
const texto = v => (typeof v === 'object' ? JSON.stringify(v) : String(v))

/** Ficha del elemento seleccionado: capa, descripción y atributos del GeoJSON */
export function FeaturePanel({ seleccion, onClose }) {
  if (!seleccion) return <div id="panel-container" />

  const { capa, feature } = seleccion
  const props = feature.properties || {}
  const claves = (capa.camposInfo.length ? capa.camposInfo : Object.keys(props))
    .filter(k => !k.startsWith('_') && !esVacio(props[k]))
  const [r, g, b] = capa.color

  return (
    <div id="panel-container" className="panel-visible">
      <div className="panel-inner">
        <div className="panel-header">
          <div
            className="panel-tipo-badge"
            style={{ background: `rgba(${r},${g},${b},0.15)`, color: `rgb(${r},${g},${b})`, borderColor: `rgba(${r},${g},${b},0.4)` }}
          >
            {capa.titulo}
          </div>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Cerrar ficha">✕</button>
        </div>

        <h2 className="panel-titulo">{nombreDeFeature(capa, feature) || capa.titulo}</h2>
        {capa.descripcion && <p className="panel-desc">{capa.descripcion}</p>}

        {claves.length > 0 && (
          <div className="panel-section">
            <div className="panel-section-label">Atributos</div>
            <dl className="panel-attrs">
              {claves.map(k => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{texto(props[k])}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {capa.creditos && (
          <div className="panel-section">
            <div className="panel-section-label">Fuente</div>
            <span className="panel-caso">{capa.creditos}</span>
          </div>
        )}
      </div>
    </div>
  )
}
