const pool = require('./db');

async function fixDb() {
  try {
    try {
      await pool.execute('ALTER TABLE producto ADD COLUMN imagen LONGTEXT NULL');
      console.log('Columna "imagen" creada como LONGTEXT. ✅');
    } catch (err) {
      if (!String(err.message || '').includes('Duplicate column name')) {
        throw err;
      }
      console.log('Columna "imagen" ya existe. ✅');
    }

    await pool.execute('ALTER TABLE producto MODIFY COLUMN imagen LONGTEXT NULL');
    console.log('Columna "imagen" ajustada a LONGTEXT. ✅');
    process.exit(0);
  } catch (err) {
    console.error('Error ajustando columna imagen:', err.message);
    process.exit(1);
  }
}

fixDb();
