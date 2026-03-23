// ── Capa de Acceso a Datos (Redis + MySQL Aiven) ────────────────────────────
const { pool }                       = require('../config/db');
const { redis, USER_CACHE_TTL }      = require('../config/redis');

const REDIS_PREFIX = 'user:';

// ── Helpers Redis ────────────────────────────────────────────────────────────

/**
 * Busca un usuario en Redis por email.
 * @param  {string}       email
 * @return {object|null}  Usuario parseado o null si no está en caché
 */
async function findInCache(email) {
  try {
    const data = await redis.get(REDIS_PREFIX + email);
    if (!data) return null;
    console.log(`⚡ Cache HIT → ${email}`);
    return JSON.parse(data);
  } catch (err) {
    console.error('⚠️  Error leyendo Redis (se continúa con MySQL):', err.message);
    return null;
  }
}

/**
 * Guarda un usuario en Redis con TTL.
 * @param {object} user  Debe contener al menos { email }
 */
async function saveToCache(user) {
  try {
    const key = REDIS_PREFIX + user.email;
    await redis.set(key, JSON.stringify(user), 'EX', USER_CACHE_TTL);
    console.log(`💾 Cache SET → ${user.email}  (TTL ${USER_CACHE_TTL}s)`);
  } catch (err) {
    console.error('⚠️  Error escribiendo en Redis:', err.message);
  }
}

/**
 * Elimina un usuario de la caché (útil al cambiar contraseña o cerrar sesión).
 * @param {string} email
 */
async function removeFromCache(email) {
  try {
    await redis.del(REDIS_PREFIX + email);
  } catch (err) {
    console.error('⚠️  Error eliminando de Redis:', err.message);
  }
}

// ── Helpers MySQL (Aiven) ────────────────────────────────────────────────────

/**
 * Busca un usuario en MySQL por email.
 * @param  {string}       email
 * @return {object|null}  Fila de usuario o null
 */
async function findInDatabase(email) {
  const [rows] = await pool.execute(
    `SELECT id_usuario AS id, nombre, email, contrasena AS password, fecha_registro AS created_at
     FROM usuario
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  if (rows.length === 0) return null;
  console.log(`🗄️  DB HIT → ${email}`);
  return rows[0];
}

/**
 * Crea un nuevo usuario en MySQL.
 * @param  {object}  userData  { nombre, email, password (ya hasheado), rol }
 * @return {object}  Usuario creado
 */
async function createInDatabase(userData) {
  const [result] = await pool.execute(
    `INSERT INTO usuario (nombre, email, contrasena, fecha_registro)
     VALUES (?, ?, ?, NOW())`,
    [userData.nombre, userData.email, userData.password]
  );

  // Retornar el usuario recién creado
  return {
    id:         result.insertId,
    nombre:     userData.nombre,
    email:      userData.email,
    rol:        userData.rol || 'CLIENTE',
    created_at: new Date()
  };
}

// ── API pública del repositorio ──────────────────────────────────────────────

/**
 * Busca un usuario primero en Redis y luego en MySQL.
 * Si lo encuentra en MySQL lo cachea automáticamente.
 * @param  {string}       email
 * @return {object|null}
 */
async function findByEmail(email) {
  // 1. Intentar Redis (caché)
  const cached = await findInCache(email);
  if (cached) return cached;

  // 2. Consultar MySQL
  const dbUser = await findInDatabase(email);
  if (!dbUser) return null;

  // 3. Cachear en Redis para próximas consultas
  await saveToCache(dbUser);
  return dbUser;
}

module.exports = {
  findByEmail,
  findInCache,
  findInDatabase,
  saveToCache,
  removeFromCache,
  createInDatabase
};
