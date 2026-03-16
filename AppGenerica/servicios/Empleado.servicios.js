const db = require('../db');

// ============= SERVICIOS DE EMPLEADOS =============

async function listarEmpleados() {
  const [rows] = await db.execute(`
    SELECT 
      e.id_empleado,
      e.codigo_empleado,
      e.fecha_contratacion,
      e.salario,
      e.departamento,
      e.puesto,
      e.estado,
      u.id_usuario,
      u.nombre,
      u.email,
      u.telefono,
      u.fecha_registro,
      GROUP_CONCAT(DISTINCT re.nombre) AS roles_empleado,
      GROUP_CONCAT(DISTINCT p.nombre_perfil) AS perfiles_asignados
    FROM empleado e
    JOIN usuario u ON e.id_usuario = u.id_usuario
    LEFT JOIN empleado_perfil ep ON e.id_empleado = ep.id_empleado
    LEFT JOIN perfil p ON ep.id_perfil = p.id_perfil
    LEFT JOIN rol_empleado re ON p.id_rol_empleado = re.id_rol_empleado
    GROUP BY e.id_empleado
    ORDER BY e.codigo_empleado
  `);
  return rows;
}

async function buscarEmpleadoPorId(id) {
  const [rows] = await db.execute(`
    SELECT 
      e.id_empleado,
      e.codigo_empleado,
      e.fecha_contratacion,
      e.salario,
      e.departamento,
      e.puesto,
      e.estado,
      u.id_usuario,
      u.nombre,
      u.email,
      u.telefono,
      u.fecha_registro
    FROM empleado e
    JOIN usuario u ON e.id_usuario = u.id_usuario
    WHERE e.id_empleado = ?
  `, [id]);
  return rows[0];
}

async function crearEmpleado(empleado) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    // Primero crear el usuario
    const [usuarioResult] = await conn.execute(
      "INSERT INTO usuario (nombre, email, contrasena, telefono) VALUES (?, ?, ?, ?)",
      [empleado.nombre, empleado.email, empleado.password || null, empleado.telefono || null]
    );
    const idUsuario = usuarioResult.insertId;

    // Luego crear el empleado
    const [empleadoResult] = await conn.execute(`
      INSERT INTO empleado (id_usuario, codigo_empleado, fecha_contratacion, salario, departamento, puesto, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      idUsuario,
      empleado.codigo_empleado,
      empleado.fecha_contratacion,
      empleado.salario || null,
      empleado.departamento || null,
      empleado.puesto || null,
      empleado.estado || 'activo'
    ]);
    const idEmpleado = empleadoResult.insertId;

    // Asignar perfiles si se proporcionaron
    if (empleado.perfiles && empleado.perfiles.length > 0) {
      for (const idPerfil of empleado.perfiles) {
        await conn.execute(
          "INSERT INTO empleado_perfil (id_empleado, id_perfil, asignado_por) VALUES (?, ?, ?)",
          [idEmpleado, idPerfil, empleado.asignado_por || null]
        );
      }
    }

    await conn.commit();
    return { id_empleado: idEmpleado, id_usuario: idUsuario };
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('email')) {
        throw new Error('El correo ya está registrado.');
      }
      if (err.message.includes('codigo_empleado')) {
        throw new Error('El código de empleado ya existe.');
      }
    }
    throw new Error('Error al crear empleado: ' + err.message);
  } finally {
    conn.release();
  }
}

async function actualizarEmpleado(id, empleado) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    // Actualizar datos del empleado
    const [empleadoResult] = await conn.execute(`
      UPDATE empleado 
      SET codigo_empleado = ?, fecha_contratacion = ?, salario = ?, departamento = ?, puesto = ?, estado = ?
      WHERE id_empleado = ?
    `, [
      empleado.codigo_empleado,
      empleado.fecha_contratacion,
      empleado.salario || null,
      empleado.departamento || null,
      empleado.puesto || null,
      empleado.estado || 'activo',
      id
    ]);

    // Actualizar datos del usuario
    await conn.execute(`
      UPDATE usuario 
      SET nombre = ?, email = ?, telefono = ?
      WHERE id_usuario = (SELECT id_usuario FROM empleado WHERE id_empleado = ?)
    `, [empleado.nombre, empleado.email, empleado.telefono || null, id]);

    await conn.commit();
    return empleadoResult.affectedRows;
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('email')) {
        throw new Error('El correo ya está registrado.');
      }
      if (err.message.includes('codigo_empleado')) {
        throw new Error('El código de empleado ya existe.');
      }
    }
    throw new Error('Error al actualizar empleado: ' + err.message);
  } finally {
    conn.release();
  }
}

async function eliminarEmpleado(id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    // El empleado se eliminará en cascada junto con el usuario debido a ON DELETE CASCADE
    const [result] = await conn.execute("DELETE FROM empleado WHERE id_empleado = ?", [id]);
    
    await conn.commit();
    return result.affectedRows;
  } catch (err) {
    await conn.rollback();
    throw new Error('Error al eliminar empleado: ' + err.message);
  } finally {
    conn.release();
  }
}

// ============= SERVICIOS DE ROLES DE EMPLEADO =============

async function listarRolesEmpleado() {
  const [rows] = await db.execute(`
    SELECT id_rol_empleado, nombre, descripcion, nivel_jerarquico, es_rol_empleado
    FROM rol_empleado
    ORDER BY nivel_jerarquico DESC, nombre
  `);
  return rows;
}

async function crearRolEmpleado(rol) {
  const [result] = await db.execute(
    "INSERT INTO rol_empleado (nombre, descripcion, nivel_jerarquico, es_rol_empleado) VALUES (?, ?, ?, ?)",
    [rol.nombre, rol.descripcion || null, rol.nivel_jerarquico || 1, rol.es_rol_empleado !== false]
  );
  return result.insertId;
}

async function actualizarRolEmpleado(id, rol) {
  const [result] = await db.execute(
    "UPDATE rol_empleado SET nombre = ?, descripcion = ?, nivel_jerarquico = ?, es_rol_empleado = ? WHERE id_rol_empleado = ?",
    [rol.nombre, rol.descripcion || null, rol.nivel_jerarquico || 1, rol.es_rol_empleado !== false, id]
  );
  return result.affectedRows;
}

async function eliminarRolEmpleado(id) {
  const [result] = await db.execute("DELETE FROM rol_empleado WHERE id_rol_empleado = ?", [id]);
  return result.affectedRows;
}

// ============= SERVICIOS DE PERFILES =============

async function listarPerfiles() {
  const [rows] = await db.execute(`
    SELECT p.id_perfil, p.nombre_perfil, p.descripcion, p.configuracion, p.activo,
           re.nombre AS nombre_rol, re.nivel_jerarquico
    FROM perfil p
    JOIN rol_empleado re ON p.id_rol_empleado = re.id_rol_empleado
    ORDER BY re.nivel_jerarquico DESC, p.nombre_perfil
  `);
  return rows;
}

async function listarPerfilesPorRol(idRolEmpleado) {
  const [rows] = await db.execute(
    "SELECT * FROM perfil WHERE id_rol_empleado = ? AND activo = TRUE ORDER BY nombre_perfil",
    [idRolEmpleado]
  );
  return rows;
}

async function crearPerfil(perfil) {
  const [result] = await db.execute(
    "INSERT INTO perfil (id_rol_empleado, nombre_perfil, descripcion, configuracion, activo) VALUES (?, ?, ?, ?, ?)",
    [perfil.id_rol_empleado, perfil.nombre_perfil, perfil.descripcion || null, perfil.configuracion ? JSON.stringify(perfil.configuracion) : null, perfil.activo !== false]
  );
  return result.insertId;
}

async function actualizarPerfil(id, perfil) {
  const [result] = await db.execute(
    "UPDATE perfil SET id_rol_empleado = ?, nombre_perfil = ?, descripcion = ?, configuracion = ?, activo = ? WHERE id_perfil = ?",
    [perfil.id_rol_empleado, perfil.nombre_perfil, perfil.descripcion || null, perfil.configuracion ? JSON.stringify(perfil.configuracion) : null, perfil.activo !== false, id]
  );
  return result.affectedRows;
}

async function eliminarPerfil(id) {
  const [result] = await db.execute("DELETE FROM perfil WHERE id_perfil = ?", [id]);
  return result.affectedRows;
}

// ============= SERVICIOS DE MENÚ DE NAVEGACIÓN =============

async function listarMenuNavegacion() {
  const [rows] = await db.execute(`
    SELECT m.id_menu, m.nombre_opcion, m.icono, m.ruta, m.descripcion, 
           m.menu_padre_id, m.orden_visualizacion, m.activo,
           padre.nombre_opcion AS nombre_padre
    FROM menu_navegacion m
    LEFT JOIN menu_navegacion padre ON m.menu_padre_id = padre.id_menu
    WHERE m.activo = TRUE
    ORDER BY m.menu_padre_id ASC, m.orden_visualizacion ASC
  `);
  return rows;
}

async function crearMenuOpcion(menu) {
  const [result] = await db.execute(
    "INSERT INTO menu_navegacion (nombre_opcion, icono, ruta, descripcion, menu_padre_id, orden_visualizacion, activo) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [menu.nombre_opcion, menu.icono || null, menu.ruta || null, menu.descripcion || null, menu.menu_padre_id || null, menu.orden_visualizacion || 0, menu.activo !== false]
  );
  return result.insertId;
}

async function actualizarMenuOpcion(id, menu) {
  const [result] = await db.execute(
    "UPDATE menu_navegacion SET nombre_opcion = ?, icono = ?, ruta = ?, descripcion = ?, menu_padre_id = ?, orden_visualizacion = ?, activo = ? WHERE id_menu = ?",
    [menu.nombre_opcion, menu.icono || null, menu.ruta || null, menu.descripcion || null, menu.menu_padre_id || null, menu.orden_visualizacion || 0, menu.activo !== false, id]
  );
  return result.affectedRows;
}

async function eliminarMenuOpcion(id) {
  const [result] = await db.execute("DELETE FROM menu_navegacion WHERE id_menu = ?", [id]);
  return result.affectedRows;
}

// ============= SERVICIOS DE PERMISOS =============

async function listarPermisosPorPerfil(idPerfil) {
  const [rows] = await db.execute(`
    SELECT ppm.id_permiso, ppm.id_perfil, ppm.id_menu, ppm.puede_ver, ppm.puede_crear, 
           ppm.puede_editar, ppm.puede_eliminar, ppm.puede_exportar,
           m.nombre_opcion, m.ruta, m.menu_padre_id
    FROM permiso_perfil_menu ppm
    JOIN menu_navegacion m ON ppm.id_menu = m.id_menu
    WHERE ppm.id_perfil = ?
    ORDER BY m.menu_padre_id ASC, m.orden_visualizacion ASC
  `, [idPerfil]);
  return rows;
}

async function listarMenuPorPerfil(idPerfil) {
  const [rows] = await db.execute(`
    SELECT 
      p.id_perfil,
      p.nombre_perfil,
      m.id_menu,
      m.nombre_opcion,
      m.icono,
      m.ruta,
      m.menu_padre_id,
      m.orden_visualizacion,
      ppm.puede_ver,
      ppm.puede_crear,
      ppm.puede_editar,
      ppm.puede_eliminar,
      ppm.puede_exportar
    FROM perfil p
    JOIN permiso_perfil_menu ppm ON p.id_perfil = ppm.id_perfil
    JOIN menu_navegacion m ON ppm.id_menu = m.id_menu
    WHERE p.id_perfil = ? AND m.activo = TRUE AND p.activo = TRUE AND ppm.puede_ver = TRUE
    ORDER BY m.menu_padre_id ASC, m.orden_visualizacion ASC
  `, [idPerfil]);
  return rows;
}

async function crearPermiso(permiso) {
  const [result] = await db.execute(
    "INSERT INTO permiso_perfil_menu (id_perfil, id_menu, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [permiso.id_perfil, permiso.id_menu, permiso.puede_ver !== false, permiso.puede_crear || false, permiso.puede_editar || false, permiso.puede_eliminar || false, permiso.puede_exportar || false, permiso.creado_por || null]
  );
  return result.insertId;
}

async function actualizarPermiso(id, permiso) {
  const [result] = await db.execute(
    "UPDATE permiso_perfil_menu SET puede_ver = ?, puede_crear = ?, puede_editar = ?, puede_eliminar = ?, puede_exportar = ? WHERE id_permiso = ?",
    [permiso.puede_ver !== false, permiso.puede_crear || false, permiso.puede_editar || false, permiso.puede_eliminar || false, permiso.puede_exportar || false, id]
  );
  return result.affectedRows;
}

async function eliminarPermiso(id) {
  const [result] = await db.execute("DELETE FROM permiso_perfil_menu WHERE id_permiso = ?", [id]);
  return result.affectedRows;
}

// ============= SERVICIOS DE ASIGNACIÓN DE PERFILES A EMPLEADOS =============

async function asignarPerfilAEmpleado(idEmpleado, idPerfil, asignadoPor) {
  const [result] = await db.execute(
    "INSERT INTO empleado_perfil (id_empleado, id_perfil, asignado_por) VALUES (?, ?, ?)",
    [idEmpleado, idPerfil, asignadoPor || null]
  );
  return result.insertId;
}

async function removerPerfilDeEmpleado(idEmpleado, idPerfil) {
  const [result] = await db.execute(
    "DELETE FROM empleado_perfil WHERE id_empleado = ? AND id_perfil = ?",
    [idEmpleado, idPerfil]
  );
  return result.affectedRows;
}

async function listarPerfilesDeEmpleado(idEmpleado) {
  const [rows] = await db.execute(`
    SELECT ep.id_empleado_perfil, ep.id_empleado, ep.id_perfil, ep.fecha_asignacion,
           p.nombre_perfil, p.descripcion, p.activo,
           re.nombre AS nombre_rol,
           u.nombre AS nombre_asignado_por
    FROM empleado_perfil ep
    JOIN perfil p ON ep.id_perfil = p.id_perfil
    JOIN rol_empleado re ON p.id_rol_empleado = re.id_rol_empleado
    LEFT JOIN usuario u ON ep.asignado_por = u.id_usuario
    WHERE ep.id_empleado = ?
    ORDER BY ep.fecha_asignacion DESC
  `, [idEmpleado]);
  return rows;
}

// ============= SERVICIOS DE AUDITORÍA =============

async function listarAuditoriaPermisos(limite = 100) {
  const [rows] = await db.execute(`
    SELECT ap.id_auditoria, ap.id_empleado_perfil, ap.accion, ap.detalle_anterior, 
           ap.detalle_nuevo, ap.fecha_auditoria,
           u.nombre AS nombre_realizado_por,
           e.codigo_empleado,
           p.nombre_perfil
    FROM auditoria_permisos ap
    LEFT JOIN usuario u ON ap.realizado_por = u.id_usuario
    LEFT JOIN empleado_perfil ep ON ap.id_empleado_perfil = ep.id_empleado_perfil
    LEFT JOIN empleado e ON ep.id_empleado = e.id_empleado
    LEFT JOIN perfil p ON ep.id_perfil = p.id_perfil
    ORDER BY ap.fecha_auditoria DESC
    LIMIT ?
  `, [limite]);
  return rows;
}

module.exports = {
  // Empleados
  listarEmpleados,
  buscarEmpleadoPorId,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
  
  // Roles de Empleado
  listarRolesEmpleado,
  crearRolEmpleado,
  actualizarRolEmpleado,
  eliminarRolEmpleado,
  
  // Perfiles
  listarPerfiles,
  listarPerfilesPorRol,
  crearPerfil,
  actualizarPerfil,
  eliminarPerfil,
  
  // Menú de Navegación
  listarMenuNavegacion,
  crearMenuOpcion,
  actualizarMenuOpcion,
  eliminarMenuOpcion,
  
  // Permisos
  listarPermisosPorPerfil,
  listarMenuPorPerfil,
  crearPermiso,
  actualizarPermiso,
  eliminarPermiso,
  
  // Asignación de Perfiles
  asignarPerfilAEmpleado,
  removerPerfilDeEmpleado,
  listarPerfilesDeEmpleado,
  
  // Auditoría
  listarAuditoriaPermisos
};
