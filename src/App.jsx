import { useRef, useState } from 'react'
import './App.css'
import { useMap } from './hooks/useMap.js'
import { LayerPanel } from './components/LayerPanel.jsx'
import { MapLegend } from './components/MapLegend.jsx'
import { FeaturePanel } from './components/FeaturePanel.jsx'

export default function App() {
  const mapRef = useRef(null)
  // El panel de capas arranca abierto en pantallas anchas
  const [panelAbierto, setPanelAbierto] = useState(() => window.innerWidth > 760)

  const getPadding = () => {
    const ancho = window.innerWidth > 760
    return { top: 90, bottom: ancho ? 170 : 150, left: ancho && panelAbierto ? 360 : 50, right: ancho ? 300 : 40 }
  }

  const {
    manifiesto, errorManifiesto, configError, activas, datos, estados, etiquetas, setEtiquetas,
    tooltip, seleccion, setSeleccion, toggleCapa, setGrupo, irACapa, verTodo,
  } = useMap(mapRef, getPadding)

  const config = manifiesto?.config ?? {}
  const contador = !manifiesto
    ? (errorManifiesto || 'cargando…')
    : `${activas.size} de ${manifiesto.capas.length} capas`

  return (
    <div id="app">
      <div id="map" ref={mapRef} />

      {configError === 'mapbox' && (
        <div className="map-config-error" role="alert">
          <strong>Mapbox no configurado</strong>
          <p>
            Define <code>VITE_MAPBOX_TOKEN</code> en <code>.env.local</code> (local) o en
            las variables de entorno del hosting, y vuelve a desplegar.
          </p>
        </div>
      )}

      <header id="header">
        <div className="header-logo">
          <h1>◈ {config.titulo || 'Cartografía'}</h1>
          {config.subtitulo && <p>{config.subtitulo}</p>}
        </div>
        <div id="conteo-wrap" className={!manifiesto && !errorManifiesto ? 'loading-pulse' : ''}>
          {contador}
        </div>
      </header>

      <div id="layer-controls">
        <button
          type="button"
          className={`layer-btn ${panelAbierto ? 'active' : ''}`}
          title="Mostrar u ocultar el panel de capas"
          aria-expanded={panelAbierto}
          onClick={() => setPanelAbierto(v => !v)}
        >
          ◐ Capas
        </button>
        <button
          type="button"
          className={`layer-btn ${etiquetas ? 'active' : ''}`}
          title="Mostrar nombres de los puntos al acercar"
          onClick={() => setEtiquetas(v => !v)}
        >
          ◉ Etiquetas
        </button>
        <button type="button" className="layer-btn" title="Encuadrar las capas visibles" onClick={verTodo}>
          ⤢ Ver todo
        </button>
      </div>

      <LayerPanel
        abierto={panelAbierto}
        onCerrar={() => setPanelAbierto(false)}
        manifiesto={manifiesto}
        activas={activas}
        estados={estados}
        onToggle={toggleCapa}
        onGrupo={setGrupo}
        onIr={irACapa}
      />

      {manifiesto && (
        <MapLegend
          capas={manifiesto.capas}
          activas={activas}
          datos={datos}
          onToggle={toggleCapa}
          desplazada={Boolean(seleccion)}
        />
      )}

      <FeaturePanel seleccion={seleccion} onClose={() => setSeleccion(null)} />

      {tooltip && (
        <div id="tooltip" className="visible" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tt-tipo">{tooltip.tipo}</div>
          <div className="tt-titulo">{tooltip.titulo}</div>
        </div>
      )}
    </div>
  )
}
