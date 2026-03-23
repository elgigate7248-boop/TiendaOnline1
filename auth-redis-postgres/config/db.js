// ── Conexión a MySQL (Aiven) ─────────────────────────────────────────────────
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:        Number(process.env.DB_PORT)    || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || 'root',
  database:           process.env.DB_NAME     || 'tienda',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

/**
 * Verifica la conexión a MySQL
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL (Aiven) conectado');
    conn.release();
    return true;
  } catch (err) {
    console.error('❌ No se pudo conectar a MySQL:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection };
