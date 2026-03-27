# draw2data

Open-source, browser-based geospatial data extraction tool. Draw an area on the map, select datasets, and download clean files — no code, no accounts, no heavy GIS software.

## What it does

1. Open the app in your browser
2. Draw a polygon or upload a GeoJSON to define your Area of Interest
3. Select datasets (Buildings, POIs, Roads)
4. Choose output format (GeoJSON, CSV, Shapefile)
5. Click Export and download your data

All processing happens in your browser using DuckDB-WASM. No backend required.

## Data source

[Overture Maps](https://overturemaps.org/) — open, interoperable geospatial datasets with clean schemas, hosted as cloud-native GeoParquet files.

## Available datasets (v1)

- **Buildings** — Building footprints
- **Places / POIs** — Points of interest
- **Roads / Transportation** — Road segments

## Output formats

- **GeoJSON** — Standard geospatial format
- **CSV** — With WKT geometry column + lat/lng for points
- **Shapefile** — Zipped .shp/.dbf/.shx/.prj bundle

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Tech stack

- React + TypeScript + Vite
- MapLibre GL JS (via react-map-gl)
- DuckDB-WASM for in-browser Parquet queries
- Tailwind CSS
- Overture Maps Foundation data

## Constraints

- AOI limited to ~50 km² to keep browser-side extraction feasible
- Designed for small-to-medium area extracts, not country-scale exports

## License

MIT
