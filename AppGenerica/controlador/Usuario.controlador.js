
const servicioUsuario = require("../servicios/Usuario.servicios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rolServicio = require("../servicios/Rol.servicios");
const JWT_SECRET = process.env.JWT_SECRET || "supersecreto";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeString(value) {
  return (value ?? "").toString().trim();
}

async function registrar(req, res) {
  try {
    const { roles } = req.body;
    const nombre = sanitizeString(req.body.nombre);
    const email = sanitizeString(req.body.email).toLowerCase();
    const password = (req.body.password ?? "").toString();

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: "Nombre, email y password son requeridos" });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }
    if (nombre.length < 2 || nombre.length > 120) {
      return res.status(400).json({ error: "Nombre inválido (2-120 caracteres)" });
    }
    if (password.length < 6 || password.length > 200) {
      return res.status(400).json({ error: "Password inválido (6-200 caracteres)" });
    }

    const hash = await bcrypt.hash(password, 10);
    const usuario = { nombre, email, password: hash, roles };
    try {
      const id = await servicioUsuario.crearUsuario(usuario);
      res.status(201).json({ message: "Usuario registrado", id });
    } catch (err) {
      // Devuelve el mensaje exacto del servicio
      res.status(400).json({ error: err.message });
    }
  } catch (err) {
    res.status(500).json({ error: "Error interno: " + err.message });
  }
}


async function login(req, res) {
  try {
    const email = sanitizeString(req.body.email).toLowerCase();
    const password = (req.body.password ?? "").toString();

    if (!email || !password) {
      return res.status(400).json({ error: "Email y password requeridos" });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }
    if (password.length > 200) {
      return res.status(400).json({ error: "Password inválido" });
    }

    const usuario = await servicioUsuario.buscarUsuarioPorEmail(email);
    if (!usuario) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    const match = await bcrypt.compare(password, usuario.contrasena);
    if (!match) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    // Generar token
    const token = jwt.sign({ id_usuario: usuario.id_usuario }, JWT_SECRET, { expiresIn: "8h" });
    const roles = await rolServicio.obtenerRolesPorUsuario(usuario.id_usuario);

    res.json({
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        roles
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Error en login: " + err.message });
  }
}

async function listarUsuarios(req, res) {
  try {
    const lista = await servicioUsuario.listarUsuarios();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: "Error al listar usuarios: " + err.message });
  }
}

async function crearUsuario(req, res) {
  try {
    const nombre = sanitizeString(req.body.nombre);
    const email = sanitizeString(req.body.email).toLowerCase();
    const telefono = sanitizeString(req.body.telefono);
    const passwordRaw = (req.body.password ?? "").toString();
    const roles = Array.isArray(req.body.roles) ? req.body.roles : [];

    if (!nombre || !email) {
      return res.status(400).json({ error: "Datos incompletos. Se requieren nombre y email." });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }
    if (nombre.length < 2 || nombre.length > 120) {
      return res.status(400).json({ error: "Nombre inválido (2-120 caracteres)" });
    }
    if (passwordRaw && (passwordRaw.length < 6 || passwordRaw.length > 200)) {
      return res.status(400).json({ error: "Password inválido (6-200 caracteres)" });
    }

    const password = passwordRaw ? await bcrypt.hash(passwordRaw, 10) : null;
    const id = await servicioUsuario.crearUsuario({
      nombre,
      email,
      telefono: telefono || null,
      password,
      roles
    });

    res.json({
      message: "Usuario creado correctamente.",
      id
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}


async function buscarUsuarioPorId(req, res) {
  try {
    const usuario = await servicioUsuario.buscarUsuarioPorId(req.params.id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ error: "Error al buscar usuario: " + err.message });
  }
}

async function actualizarUsuario(req, res) {
  try {
    const payload = {};
    if (req.body.nombre !== undefined) {
      const nombre = sanitizeString(req.body.nombre);
      if (!nombre || nombre.length < 2 || nombre.length > 120) {
        return res.status(400).json({ error: "Nombre inválido (2-120 caracteres)" });
      }
      payload.nombre = nombre;
    }
    if (req.body.email !== undefined) {
      const email = sanitizeString(req.body.email).toLowerCase();
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: "Email inválido" });
      }
      payload.email = email;
    }
    if (req.body.telefono !== undefined) {
      payload.telefono = sanitizeString(req.body.telefono) || null;
    }
    if (req.body.fecha_registro !== undefined) {
      const fecha = new Date(req.body.fecha_registro);
      if (Number.isNaN(fecha.getTime())) {
        return res.status(400).json({ error: "Fecha de registro inválida" });
      }
      payload.fecha_registro = fecha;
    }

    const filas = await servicioUsuario.actualizarUsuario(req.params.id, payload);
    if (filas === 0) {
      return res.status(404).json({ error: "Usuario no encontrado para actualizar." });
    }
    res.json({ message: "Usuario actualizado correctamente." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function eliminarUsuario(req, res) {
  try {
    const filas = await servicioUsuario.eliminarUsuario(req.params.id);
    if (filas === 0) {
      return res.status(404).json({ error: "Usuario no encontrado para eliminar." });
    }
    res.json({ message: "Usuario eliminado correctamente." });
  } catch (err) {
    if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451)) {
      return res.status(409).json({ error: "No se puede eliminar el usuario porque tiene registros asociados." });
    }
    res.status(err.status || 500).json({ error: "Error al eliminar usuario: " + err.message });
  }
}

async function obtenerPerfil(req, res) {
  try {
    const usuario = await servicioUsuario.buscarUsuarioPorId(req.usuario.id_usuario);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    const roles = await rolServicio.obtenerRolesPorUsuario(usuario.id_usuario);
    res.json({
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      email: usuario.email,
      roles
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener perfil: " + err.message });
  }
}

module.exports = {
  listarUsuarios,
  crearUsuario,
  buscarUsuarioPorId,
  actualizarUsuario,
  eliminarUsuario,
  registrar,
  login,
  obtenerPerfil
};
