// ── Servicio de Autenticación ────────────────────────────────────────────────
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const userRepo = require('../repositories/user.repository');

const JWT_SECRET     = process.env.JWT_SECRET     || 'superSecretKey_cambiar_en_produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN  || '24h';
const SALT_ROUNDS    = 10;

/**
 * Genera un JWT para el usuario autenticado.
 * @param  {object} user  { id, email, nombre, rol }
 * @return {string}       Token firmado
 */
function generarToken(user) {
  const payload = {
    id:     user.id,
    email:  user.email,
    nombre: user.nombre,
    rol:    user.rol
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Flujo completo de login:
 *
 *  1. Buscar usuario en Redis (caché).
 *  2. Si no está → buscar en MySQL → cachear en Redis.
 *  3. Validar contraseña con bcrypt.
 *  4. Si es correcta → generar JWT y retornar datos.
 *
 * @param  {string} email
 * @param  {string} password   (texto plano)
 * @return {object}            { token, usuario }
 * @throws {Error}             Con propiedad `status` (401, 404, 500)
 */
async function login(email, password) {
  // ── 1–2. Buscar usuario (Redis → MySQL) ─────────────────────────────────
  const user = await userRepo.findByEmail(email);

  if (!user) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  // ── 3. Validar contraseña ─────────────────────────────────────────────────
  const passwordValida = await bcrypt.compare(password, user.password);

  if (!passwordValida) {
    const err = new Error('Contraseña incorrecta');
    err.status = 401;
    throw err;
  }

  // ── 4. Generar JWT ────────────────────────────────────────────────────────
  const token = generarToken(user);

  // Retornar sin exponer el hash de contraseña
  const { password: _, ...usuarioSeguro } = user;

  return {
    token,
    usuario: usuarioSeguro
  };
}

/**
 * Flujo completo de registro:
 *
 *  1. Verificar que el email no exista.
 *  2. Hashear la contraseña con bcrypt.
 *  3. Insertar en MySQL.
 *  4. Cachear en Redis.
 *  5. Generar JWT.
 *
 * @param  {object} datos  { nombre, email, password, rol? }
 * @return {object}        { token, usuario }
 */
async function registro(datos) {
  // 1. Verificar duplicado
  const existente = await userRepo.findByEmail(datos.email);
  if (existente) {
    const err = new Error('El email ya está registrado');
    err.status = 409;
    throw err;
  }

  // 2. Hash de contraseña
  const hashedPassword = await bcrypt.hash(datos.password, SALT_ROUNDS);

  // 3. Insertar en MySQL
  const nuevoUsuario = await userRepo.createInDatabase({
    nombre:   datos.nombre,
    email:    datos.email,
    password: hashedPassword,
    rol:      datos.rol || 'CLIENTE'
  });

  // 4. Cachear en Redis (guardar con hash para validar login desde caché)
  await userRepo.saveToCache({
    ...nuevoUsuario,
    password: hashedPassword
  });

  // 5. Generar JWT
  const token = generarToken(nuevoUsuario);

  return {
    token,
    usuario: nuevoUsuario
  };
}

/**
 * Cierre de sesión — invalida la caché del usuario.
 * @param {string} email
 */
async function logout(email) {
  await userRepo.removeFromCache(email);
}

module.exports = {
  login,
  registro,
  logout,
  generarToken
};
