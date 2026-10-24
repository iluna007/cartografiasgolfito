# Cartografía del Golfito

Visor de mapa (React + Vite + Mapbox GL + deck.gl) cuyas capas se administran desde una hoja de Google Sheets.
El sistema de mapa, panel de capas, leyenda y ficha es una réplica del de `archivo-atlas`, pero dirigido por datos:
agregar una capa no requiere tocar código.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # pega tu VITE_MAPBOX_TOKEN
npm run dev
```

## Flujo para agregar una capa

1. En QGIS: clic derecho en la capa, **Exportar > Guardar objetos como > GeoJSON**.
   Lo ideal es EPSG:4326, pero el mapa reproyecta solo si el archivo declara otro CRS
   (EPSG:8908 y 5367 CRTM05, 9377, 3857, UTM 10 a 20 N/S). Si no declara CRS y está en metros, indica el EPSG en la columna `crs`.
2. Copia el `.geojson` a `public/capas/` (o súbelo a una URL pública con CORS).
3. En la hoja de Google Sheets, pestaña **Capas**, agrega una fila con el nombre del archivo en `archivo`.
4. Recarga el mapa. No hace falta recompilar.

## El CMS (Google Sheets)

Hoja: <https://docs.google.com/spreadsheets/d/1WxUVLzW_kKoudoduK5Xf23RMKEW3ZSnsOQRv9EXkbOg/edit>

| Pestaña | Contenido |
| --- | --- |
| `Capas` | Una fila por capa: título, grupo, archivo, tipo (`linea`, `punto`, `triangulo`, `poligono`), colores hex, grosor, radio, punteada, visibilidad inicial, campo de nombre, campos de la ficha, créditos. |
| `Grupos` | Secciones del panel (orden, título, plegado). |
| `Config` | Título, subtítulo, estilo Mapbox, encuadre inicial, créditos del panel. |
| `LEEME` | Instrucciones y descripción de cada columna. |

Para que el sitio lea la hoja, compártela como **Cualquier persona con el enlace: Lector**.
Si la hoja es privada o no hay red, el sitio usa la copia local `public/capas/*.csv`
(se actualiza con `npm run sync:capas`). El panel indica de cuál de las dos está leyendo.

Para usar otra hoja: cambia `sheetId` en `src/data/fuente.json` o define `VITE_CAPAS_SHEET_ID`
(`local` fuerza la copia local).

## Estructura

```
src/data/capas.js        lee el listado (Sheets o CSV local) y descarga cada GeoJSON al encender la capa
src/lib/crs.js           reproyecta a WGS84 con proj4 (CRTM05, UTM, etc.)
src/map/layers.js        capas deck.gl: línea (con contorno y punteado), punto, triángulo, polígono, etiquetas
src/hooks/useMap.js      mapa Mapbox + overlay deck.gl, encuadre, selección
src/components/          LayerPanel (panel de capas), MapLegend (leyenda), FeaturePanel (ficha), Muestra
public/capas/            GeoJSON de las capas y copia local de la hoja
```
