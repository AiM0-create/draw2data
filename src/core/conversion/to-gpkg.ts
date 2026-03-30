import type { Feature } from '../../types';
import initSqlJs, { type Database } from 'sql.js';

// We need to encode geometry as GeoPackage binary (Standard GeoPackageBinary header + WKB)
function featureToWkb(geom: { type: string; coordinates: unknown }): Uint8Array | null {
  // Simplified WKB encoding for common geometry types
  const parts: number[] = [];
  const view = new DataView(new ArrayBuffer(8));

  function writeDouble(val: number) {
    view.setFloat64(0, val, true);
    for (let i = 0; i < 8; i++) parts.push(view.getUint8(i));
  }
  function writeUint32(val: number) {
    view.setUint32(0, val, true);
    for (let i = 0; i < 4; i++) parts.push(view.getUint8(i));
  }

  // Byte order: little-endian
  parts.push(1);

  switch (geom.type) {
    case 'Point': {
      const c = geom.coordinates as number[];
      writeUint32(1); // wkbPoint
      writeDouble(c[0]); writeDouble(c[1]);
      break;
    }
    case 'LineString': {
      const coords = geom.coordinates as number[][];
      writeUint32(2); // wkbLineString
      writeUint32(coords.length);
      for (const c of coords) { writeDouble(c[0]); writeDouble(c[1]); }
      break;
    }
    case 'Polygon': {
      const rings = geom.coordinates as number[][][];
      writeUint32(3); // wkbPolygon
      writeUint32(rings.length);
      for (const ring of rings) {
        writeUint32(ring.length);
        for (const c of ring) { writeDouble(c[0]); writeDouble(c[1]); }
      }
      break;
    }
    case 'MultiPoint': {
      const pts = geom.coordinates as number[][];
      writeUint32(4); // wkbMultiPoint
      writeUint32(pts.length);
      for (const c of pts) {
        parts.push(1); writeUint32(1); writeDouble(c[0]); writeDouble(c[1]);
      }
      break;
    }
    case 'MultiLineString': {
      const lines = geom.coordinates as number[][][];
      writeUint32(5);
      writeUint32(lines.length);
      for (const line of lines) {
        parts.push(1); writeUint32(2);
        writeUint32(line.length);
        for (const c of line) { writeDouble(c[0]); writeDouble(c[1]); }
      }
      break;
    }
    case 'MultiPolygon': {
      const polys = geom.coordinates as number[][][][];
      writeUint32(6);
      writeUint32(polys.length);
      for (const poly of polys) {
        parts.push(1); writeUint32(3);
        writeUint32(poly.length);
        for (const ring of poly) {
          writeUint32(ring.length);
          for (const c of ring) { writeDouble(c[0]); writeDouble(c[1]); }
        }
      }
      break;
    }
    default:
      return null;
  }

  // GeoPackage Binary Header: GP, version 0, flags (little-endian, envelope type 0), srs_id=4326
  const wkb = new Uint8Array(parts);
  const gpb = new Uint8Array(8 + wkb.length);
  gpb[0] = 0x47; gpb[1] = 0x50; // "GP"
  gpb[2] = 0; // version
  gpb[3] = 1; // flags: little-endian, no envelope
  // srs_id = 4326 little-endian
  gpb[4] = 0xE6; gpb[5] = 0x10; gpb[6] = 0; gpb[7] = 0;
  gpb.set(wkb, 8);
  return gpb;
}

let sqlJsPromise: Promise<{ Database: new () => Database }> | null = null;

function loadSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });
  }
  return sqlJsPromise;
}

export async function toGeoPackageBlob(features: Feature[]): Promise<Blob> {
  const SQL = await loadSqlJs();
  const db = new SQL.Database();

  // GeoPackage required tables
  db.run(`CREATE TABLE gpkg_spatial_ref_sys (
    srs_name TEXT NOT NULL, srs_id INTEGER NOT NULL PRIMARY KEY,
    organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL,
    definition TEXT NOT NULL, description TEXT
  )`);
  db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES ('WGS 84', 4326, 'EPSG', 4326, 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]', NULL)`);
  db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES ('Undefined Cartesian', -1, 'NONE', -1, 'undefined', NULL)`);
  db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES ('Undefined Geographic', 0, 'NONE', 0, 'undefined', NULL)`);

  db.run(`CREATE TABLE gpkg_contents (
    table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL,
    identifier TEXT, description TEXT DEFAULT '',
    last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE, srs_id INTEGER,
    CONSTRAINT fk_gc_r_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
  )`);

  db.run(`CREATE TABLE gpkg_geometry_columns (
    table_name TEXT NOT NULL, column_name TEXT NOT NULL, geometry_type_name TEXT NOT NULL,
    srs_id INTEGER NOT NULL, z TINYINT NOT NULL, m TINYINT NOT NULL,
    CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name),
    CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name),
    CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
  )`);

  // Collect properties
  const propKeys = new Set<string>();
  for (const f of features.slice(0, 200)) {
    if (f.properties) {
      for (const k of Object.keys(f.properties)) {
        if (!k.startsWith('_')) propKeys.add(k);
      }
    }
  }
  const columns = [...propKeys];

  const colDefs = columns.map((c) => `"${c}" TEXT`).join(', ');
  db.run(`CREATE TABLE features (fid INTEGER PRIMARY KEY AUTOINCREMENT, geom BLOB${colDefs ? ', ' + colDefs : ''})`);

  db.run(`INSERT INTO gpkg_contents VALUES ('features', 'features', 'features', 'draw2data export', strftime('%Y-%m-%dT%H:%M:%fZ','now'), -180, -90, 180, 90, 4326)`);
  db.run(`INSERT INTO gpkg_geometry_columns VALUES ('features', 'geom', 'GEOMETRY', 4326, 0, 0)`);

  // Insert features
  const placeholders = columns.map(() => '?').join(', ');
  const insertSql = `INSERT INTO features (geom${columns.length ? ', ' + columns.map((c) => `"${c}"`).join(', ') : ''}) VALUES (?${placeholders ? ', ' + placeholders : ''})`;

  const stmt = db.prepare(insertSql);
  for (const f of features) {
    const geomBin = f.geometry ? featureToWkb(f.geometry as { type: string; coordinates: unknown }) : null;
    const vals: (string | number | null | Uint8Array)[] = [geomBin];
    for (const col of columns) {
      const v = f.properties?.[col];
      vals.push(v != null ? String(v) : null);
    }
    stmt.run(vals);
  }
  stmt.free();

  const data = db.export();
  db.close();
  return new Blob([data], { type: 'application/geopackage+sqlite3' });
}
