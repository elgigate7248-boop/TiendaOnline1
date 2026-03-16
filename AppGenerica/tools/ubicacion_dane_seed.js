const https = require('https');
const db = require('../db');

const SOURCE_URL = 'https://raw.githubusercontent.com/RafaelRamosR/dane-codigos-municipios/main/resources/source_data.json';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} al descargar dataset`));
          res.resume();
          return;
        }
        res.setEncoding('utf8');
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function ensureSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS departamento (
      codigo_dane CHAR(2) NOT NULL,
      nombre VARCHAR(120) NOT NULL,
      PRIMARY KEY (codigo_dane)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ciudad (
      codigo_dane CHAR(5) NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      codigo_dane_departamento CHAR(2) NOT NULL,
      PRIMARY KEY (codigo_dane),
      KEY idx_ciudad_dep (codigo_dane_departamento),
      CONSTRAINT fk_ciudad_departamento
        FOREIGN KEY (codigo_dane_departamento)
        REFERENCES departamento (codigo_dane)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function seed() {
  console.log('Descargando dataset DANE...');
  const items = await fetchJson(SOURCE_URL);
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Dataset vacío o inválido');
  }

  const departamentos = new Map();
  const ciudades = new Map();

  for (const it of items) {
    const depCod = String(it.departamentoDANE || '').padStart(2, '0').slice(-2);
    const depNom = String(it.departamento || '').trim();
    const munCod = String(it.municipioDANE || '').padStart(5, '0').slice(-5);
    const munNom = String(it.municipio || '').trim();

    if (depCod && depNom) departamentos.set(depCod, depNom);
    if (munCod && munNom && depCod) {
      ciudades.set(munCod, { nombre: munNom, departamento: depCod });
    }
  }

  console.log(`Departamentos: ${departamentos.size}`);
  console.log(`Ciudades/Municipios: ${ciudades.size}`);

  await ensureSchema();

  const conn = await db.getConnection();
  try {
    console.log('Insertando departamentos...');
    await conn.beginTransaction();

    for (const [codigo, nombre] of departamentos.entries()) {
      await conn.execute(
        `INSERT INTO departamento (codigo_dane, nombre)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
        [codigo, nombre]
      );
    }
    await conn.commit();

    console.log('Insertando ciudades en lotes...');
    const entries = Array.from(ciudades.entries());
    const BATCH_SIZE = Number(process.env.DANE_SEED_BATCH_SIZE || 250);
    let inserted = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await conn.beginTransaction();
      try {
        for (const [codigo, c] of batch) {
          await conn.execute(
            `INSERT INTO ciudad (codigo_dane, nombre, codigo_dane_departamento)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
               nombre = VALUES(nombre),
               codigo_dane_departamento = VALUES(codigo_dane_departamento)`,
            [codigo, c.nombre, c.departamento]
          );
        }
        await conn.commit();
      } catch (e) {
        try {
          await conn.rollback();
        } catch {}
        throw e;
      }
      inserted += batch.length;
      console.log(`Progreso ciudades: ${inserted}/${entries.length}`);
    }
  } finally {
    conn.release();
  }

  console.log('OK: Seed completado.');
}

seed().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
