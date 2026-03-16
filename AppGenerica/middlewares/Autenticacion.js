const jwt = require("jsonwebtoken");
const rolServicio = require("../servicios/Rol.servicios");

const JWT_SECRET = process.env.JWT_SECRET || "supersecreto";

module.exports = async function autenticacion(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }
    const token = authHeader.split(" ")[1];
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    const idUsuario = payload.id_usuario;
    if (!idUsuario) {
      return res.status(401).json({ error: "Token sin usuario" });
    }
    const roles = await rolServicio.obtenerRolesPorUsuario(idUsuario);
    req.usuario = {
      id: idUsuario,
      roles
    };
    next();
  } catch (err) {
    res.status(500).json({ error: "Error en autenticación" });
  }
};
