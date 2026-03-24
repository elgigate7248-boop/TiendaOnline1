// ── Capa de Acceso a Datos (Redis + MySQL Aiven) ────────────────────────────
const { pool }                       = require('../config/db');
const { redis, USER_CACHE_TTL }      = require('../config/redis');

const REDIS_PREFIX = 'user:';
const SESSION_PREFIX = 'session:';
const PERMISOS_PREFIX = 'permisos:';
const MENU_KEY = 'menu:navegacion';

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

/**
 * Guarda una sesion activa en Redis con los permisos del usuario.
 * Se crea al hacer login exitoso.
 * @param {string} token  JWT del usuario
 * @param {object} user   { id, email, nombre, rol }
 */
async function saveSession(token, user) {
  try {
    const sessionData = {
      id:     user.id,
      email:  user.email,
      nombre: user.nombre,
      rol:    user.rol,
      permisos: obtenerPermisosPorRol(user.rol),
      loginAt: new Date().toISOString()
    };
    await redis.set(SESSION_PREFIX + token, JSON.stringify(sessionData), 'EX', USER_CACHE_TTL);
    console.log(`🔐 Sesion CREADA en Redis → ${user.email} (rol: ${user.rol})`);

    // Guardar permisos del usuario por email
    await redis.set(
      PERMISOS_PREFIX + user.email,
      JSON.stringify({ rol: user.rol, permisos: obtenerPermisosPorRol(user.rol) }),
      'EX', USER_CACHE_TTL
    );
    console.log(`🛡️  Permisos GUARDADOS en Redis → ${user.email}: [${obtenerPermisosPorRol(user.rol).join(', ')}]`);
  } catch (err) {
    console.error('⚠️  Error guardando sesion en Redis:', err.message);
  }
}

/**
 * Obtiene la sesion activa desde Redis usando el token JWT.
 * @param  {string}       token
 * @return {object|null}  Datos de sesion con permisos o null
 */
async function getSession(token) {
  try {
    const data = await redis.get(SESSION_PREFIX + token);
    if (!data) return null;
    console.log(`🔐 Sesion VERIFICADA desde Redis`);
    return JSON.parse(data);
  } catch (err) {
    console.error('⚠️  Error leyendo sesion de Redis:', err.message);
    return null;
  }
}

/**
 * Elimina la sesion activa de Redis (logout).
 * @param {string} token
 * @param {string} email
 */
async function removeSession(token, email) {
  try {
    await redis.del(SESSION_PREFIX + token);
    await redis.del(PERMISOS_PREFIX + email);
    console.log(`🔐 Sesion ELIMINADA de Redis → ${email}`);
  } catch (err) {
    console.error('⚠️  Error eliminando sesion de Redis:', err.message);
  }
}

/**
 * Obtiene los permisos del usuario desde Redis.
 * @param  {string}       email
 * @return {object|null}  { rol, permisos: [...] }
 */
async function getPermisos(email) {
  try {
    const data = await redis.get(PERMISOS_PREFIX + email);
    if (!data) return null;
    console.log(`🛡️  Permisos LEIDOS desde Redis → ${email}`);
    return JSON.parse(data);
  } catch (err) {
    console.error('⚠️  Error leyendo permisos de Redis:', err.message);
    return null;
  }
}

/**
 * Define los permisos segun el rol del usuario.
 * @param  {string}   rol  'ADMIN', 'VENDEDOR', 'CLIENTE'
 * @return {string[]}      Lista de permisos
 */
function obtenerPermisosPorRol(rol) {
  const permisosPorRol = {
    ADMIN:    ['leer', 'escribir', 'eliminar', 'gestionar_usuarios', 'gestionar_pedidos', 'ver_reportes'],
    VENDEDOR: ['leer', 'escribir', 'gestionar_pedidos', 'ver_reportes'],
    CLIENTE:  ['leer', 'crear_pedido', 'ver_mis_pedidos', 'cancelar_pedido']
  };
  return permisosPorRol[rol] || ['leer'];
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

// ── Actualización de credenciales (email / contraseña) ──────────────────────

/**
 * Actualiza el email del usuario en MySQL y sincroniza Redis.
 * @param {number} userId
 * @param {string} emailAnterior
 * @param {string} emailNuevo
 */
async function updateEmail(userId, emailAnterior, emailNuevo) {
  // 1. Actualizar en MySQL
  await pool.execute(
    'UPDATE usuario SET email = ? WHERE id_usuario = ?',
    [emailNuevo, userId]
  );
  console.log(`📝 MySQL UPDATE email → ${emailAnterior} → ${emailNuevo}`);

  // 2. Eliminar cache antigua de Redis
  await removeFromCache(emailAnterior);

  // 3. Obtener datos actualizados y re-cachear
  const updatedUser = await findInDatabase(emailNuevo);
  if (updatedUser) {
    await saveToCache(updatedUser);
    console.log(`🔄 Redis ACTUALIZADO → nueva clave user:${emailNuevo}`);
  }

  return updatedUser;
}

/**
 * Actualiza la contraseña del usuario en MySQL y sincroniza Redis.
 * @param {number} userId
 * @param {string} email
 * @param {string} newHashedPassword  Ya hasheado con bcrypt
 */
async function updatePassword(userId, email, newHashedPassword) {
  // 1. Actualizar en MySQL
  await pool.execute(
    'UPDATE usuario SET contrasena = ? WHERE id_usuario = ?',
    [newHashedPassword, userId]
  );
  console.log(`📝 MySQL UPDATE contraseña → usuario ${email}`);

  // 2. Actualizar cache en Redis con nuevo hash
  const updatedUser = await findInDatabase(email);
  if (updatedUser) {
    await saveToCache(updatedUser);
    console.log(`🔄 Redis ACTUALIZADO contraseña → user:${email}`);
  }

  return updatedUser;
}

// ── Menú de Navegación (Redis cache ← MySQL) ─────────────────────────────────

/**
 * Obtiene el menú de navegación desde Redis.
 * Si no está en cache, lo carga desde MySQL y lo guarda en Redis.
 * @param {string} rol  Rol del usuario para filtrar permisos
 * @return {object[]}   Lista de opciones del menú
 */
async function getMenu(rol) {
  try {
    // 1. Intentar Redis
    const cached = await redis.get(MENU_KEY);
    if (cached) {
      console.log(`⚡ Menu Cache HIT (Redis)`);
      const fullMenu = JSON.parse(cached);
      return filtrarMenuPorRol(fullMenu, rol);
    }

    // 2. Si no está en Redis, cargar desde MySQL
    console.log(`🗄️  Menu DB HIT → cargando desde MySQL...`);
    const [rows] = await pool.execute(
      `SELECT id_menu, nombre_opcion, icono, ruta, descripcion,
             menu_padre_id, orden_visualizacion, activo
       FROM menu_navegacion
       WHERE activo = 1
       ORDER BY orden_visualizacion ASC`
    );

    // 3. Guardar en Redis
    await redis.set(MENU_KEY, JSON.stringify(rows), 'EX', USER_CACHE_TTL);
    console.log(`💾 Menu GUARDADO en Redis (${rows.length} opciones, TTL ${USER_CACHE_TTL}s)`);

    return filtrarMenuPorRol(rows, rol);
  } catch (err) {
    console.error('⚠️  Error obteniendo menú:', err.message);
    // Fallback directo a MySQL si Redis falla
    const [rows] = await pool.execute(
      `SELECT id_menu, nombre_opcion, icono, ruta, descripcion,
             menu_padre_id, orden_visualizacion, activo
       FROM menu_navegacion WHERE activo = 1 ORDER BY orden_visualizacion ASC`
    );
    return filtrarMenuPorRol(rows, rol);
  }
}

/**
 * Filtra las opciones del menú según el rol del usuario.
 * ADMIN ve todo, otros ven opciones limitadas.
 */
function filtrarMenuPorRol(menu, rol) {
  const rutasPublicas = ['/', '/perfil'];
  const rutasPorRol = {
    ADMIN:    null, // null = ve TODO
    VENDEDOR: ['/admin/productos', '/admin/pedidos', '/admin/reportes', '/perfil'],
    CLIENTE:  ['/perfil', '/mis-pedidos', '/catalogo'],
    REPARTIDOR: ['/admin/pedidos', '/perfil']
  };

  const rutasPermitidas = rutasPorRol[rol];
  if (rutasPermitidas === null || rutasPermitidas === undefined) return menu;

  const todasPermitidas = [...rutasPublicas, ...rutasPermitidas];
  return menu.filter(item => todasPermitidas.some(rp => item.ruta && item.ruta.startsWith(rp)));
}

/**
 * Invalida la cache del menú en Redis (cuando se modifica en MySQL).
 */
async function invalidateMenuCache() {
  try {
    await redis.del(MENU_KEY);
    console.log(`🗑️  Menu cache INVALIDADO en Redis`);
  } catch (err) {
    console.error('⚠️  Error invalidando menu cache:', err.message);
  }
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
  createInDatabase,
  saveSession,
  getSession,
  removeSession,
  getPermisos,
  obtenerPermisosPorRol,
  updateEmail,
  updatePassword,
  getMenu,
  invalidateMenuCache
};
