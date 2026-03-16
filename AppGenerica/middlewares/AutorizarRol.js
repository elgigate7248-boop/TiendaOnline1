module.exports = function autorizarRol(rolesPermitidos = []) {
  return (req, res, next) => {
    try {
      // Se asume que req.usuario ya viene cargado (login / JWT)
      const rolesUsuario = req.usuario.roles;

      if (!rolesUsuario || rolesUsuario.length === 0) {
        return res.status(403).json({
          error: "Usuario sin roles asignados"
        });
      }

      const autorizado = rolesUsuario.some(rol =>
        rolesPermitidos.includes(rol)
      );

      if (!autorizado) {
        return res.status(403).json({
          error: "Acceso denegado por rol"
        });
      }

      next();
    } catch (err) {
      return res.status(500).json({
        error: "Error en autorización de roles"
      });
    }
  };
};
