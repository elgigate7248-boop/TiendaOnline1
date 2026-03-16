const servicioEmpleado = require('../servicios/Empleado.servicios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "supersecreto";

// ============= CONTROLADORES DE EMPLEADOS =============

async function listarEmpleados(req, res) {
  try {
    const lista = await servicioEmpleado.listarEmpleados();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: "Error al listar empleados: " + err.message });
  }
}

async function buscarEmpleadoPorId(req, res) {
  try {
    const empleado = await servicioEmpleado.buscarEmpleadoPorId(req.params.id);
    if (!empleado) {
      return res.status(404).json({ error: "Empleado no encontrado." });
    }
    res.json(empleado);
  } catch (err) {
    res.status(500).json({ error: "Error al buscar empleado: " + err.message });
  }
}

async function crearEmpleado(req, res) {
  try {
    const empleado = req.body;

    // Validaciones básicas
    if (!empleado.nombre || !empleado.email || !empleado.codigo_empleado || !empleado.fecha_contratacion) {
      return res.status(400).json({
        error: "Datos incompletos. Se requieren nombre, email, código_empleado y fecha_contratacion."
      });
    }

    // Si se proporciona contraseña, encriptarla
    if (empleado.password) {
      empleado.password = await bcrypt.hash(empleado.password, 10);
    }

    // Agregar información de quién está creando el empleado
    empleado.asignado_por = req.usuario?.id_usuario || null;

    const resultado = await servicioEmpleado.crearEmpleado(empleado);
    res.status(201).json({
      message: "Empleado creado correctamente.",
      ...resultado
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function actualizarEmpleado(req, res) {
  try {
    const empleado = req.body;
    const filas = await servicioEmpleado.actualizarEmpleado(req.params.id, empleado);
    if (filas === 0) {
      return res.status(404).json({ error: "Empleado no encontrado para actualizar." });
    }
    res.json({ message: "Empleado actualizado correctamente." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function eliminarEmpleado(req, res) {
  try {
    const filas = await servicioEmpleado.eliminarEmpleado(req.params.id);
    if (filas === 0) {
      return res.status(404).json({ error: "Empleado no encontrado para eliminar." });
    }
    res.json({ message: "Empleado eliminado correctamente." });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar empleado: " + err.message });
  }
}

// ============= CONTROLADORES DE ROLES DE EMPLEADO =============

async function listarRolesEmpleado(req, res) {
  try {
    const lista = await servicioEmpleado.listarRolesEmpleado();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: "Error al listar roles de empleado: " + err.message });
  }
}

async function crearRolEmpleado(req, res) {
  try {
    const rol = req.body;
    if (!rol.nombre) {
      return res.status(400).json({ error: "El nombre del rol es requerido." });
    }
    const id = await servicioEmpleado.crearRolEmpleado(rol);
    res.status(201).json({
      message: "Rol de empleado creado correctamente.",
      id
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function actualizarRolEmpleado(req, res) {
  try {
    const rol = req.body;
    const filas = await servicioEmpleado.actualizarRolEmpleado(req.params.id, rol);
    if (filas === 0) {
      return res.status(404).json({ error: "Rol de empleado no encontrado para actualizar." });
    }
    res.json({ message: "Rol de empleado actualizado correctamente." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function eliminarRolEmpleado(req, res) {
  try {
    const filas = await servicioEmpleado.eliminarRolEmpleado(req.params.id);
    if (filas === 0) {
      return res.status(404).json({ error: "Rol de empleado no encontrado para eliminar." });
    }
    res.json({ message: "Rol de empleado eliminado correctamente." });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar rol de empleado: " + err.message });
  }
}

// ============= CONTROLADORES DE PERFILES =============

async function listarPerfiles(req, res) {
  try {
    const lista = await servicioEmpleado.listarPerfiles();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: "Error al listar perfiles: " + err.message });
  }
}

async function listarPerfilesPorRol(req, res) {
  try {
    const lista = await servicioEmpleado.listarPerfilesPorRol(req.params.idRol);
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: "Error al listar perfiles por rol: " + err.message });
  }
}

async function crearPerfil(req, res) {
  try {
    const perfil = req.body;
    if (!perfil.nombre_perfil || !perfil.id_rol_empleado) {
      return res.status(400).json({ 
        error: "Datos incompletos. Se requieren nombre_perfil e id_rol_empleado." 
      });
    }
    const id = await servicioEmpleado.crearPerfil(perfil);
    res.status(201).json({
      message: "Perfil creado correctamente.",
      id
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function actualizarPerfil(req, res) {
  try {
    const perfil = req.body;
    const filas = await servicioEmpleado.actualizarPerfil(req.params.id, perfil);
    if (filas === 0) {
      return res.status(404).json({ error: "Perfil no encontrado para actualizar." });
    }
    res.json({ message: "Perfil actualizado correctamente." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function eliminarPerfil(req, res) {
  try {
    const filas = await servicioEmpleado.eliminarPerfil(req.params.id);
    if (filas === 0) {
      return res.status(404).json({ error: "Perfil no encontrado para eliminar." });
    }
    res.json({ message: "Perfil eliminado correctamente." });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar perfil: " + err.message });
  }
}

// ============= CONTROLADORES DE MENÚ DE NAVEGACIÓN =============

async function listarMenuNavegacion(req, res) {
  try {
    const lista = await servicioEmpleado.listarMenuNavegacion();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: "Error al listar menú de navegación: " + err.message });
  }
}

async function crearMenuOpcion(req, res) {
  try {
    const menu = req.body;
    if (!menu.nombre_opcion) {
      return res.status(400).json({ error: "El nombre de la opción de menú es requerido." });
    }
    const id = await servicioEmpleado.crearMenuOpcion(menu);
    res.status(201).json({
      message: "Opción de menú creada correctamente.",
      id
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function actualizarMenuOpcion(req, res) {
  try {
    const menu = req.body;
    const filas = await servicioEmpleado.actualizarMenuOpcion(req.params.id, menu);
    if (filas === 0) {
      return res.status(404).json({ error: "Opción de menú no encontrada para actualizar." });
    }
    res.json({ message: "Opción de menú actualizada correctamente." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function eliminarMenuOpcion(req, res) {
  try {
    const filas = await servicioEmpleado.eliminarMenuOpcion(req.params.id);
    if (filas === 0) {
      return res.status(404).json({ error: "Opción de menú no encontrada para eliminar." });
    }
    res.json({ message: "Opción de menú eliminada correctamente." });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar opción de menú: " + err.message });
  }
}

// ============= CONTROLADORES DE PERMISOS =============

async function listarPermisosPorPerfil(req, res) {
  try {
    const lista = await servicioEmpleado.listarPermisosPorPerfil(req.params.idPerfil);
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: "Error al listar permisos por perfil: " + err.message });
  }
}

async function obtenerMenuPorPerfil(req, res) {
  try {
    // Obtener el perfil del usuario actual
    const usuarioId = req.usuario.id_usuario;
    
    // Buscar los perfiles asignados al empleado
    const [perfilesRows] = await require('../db').execute(`
      SELECT ep.id_perfil 
      FROM empleado_perfil ep
      JOIN empleado e ON ep.id_empleado = e.id_empleado
      WHERE e.id_usuario = ?
    `, [usuarioId]);

    if (perfilesRows.length === 0) {
      return res.json([]); // Usuario no tiene perfiles asignados
    }

    // Obtener el menú para todos los perfiles del usuario
    const todosLosPermisos = [];
    for (const perfilRow of perfilesRows) {
      const menuPerfil = await servicioEmpleado.listarMenuPorPerfil(perfilRow.id_perfil);
      todosLosPermisos.push(...menuPerfil);
    }

    // Eliminar duplicados y organizar jerárquicamente
    const menuUnico = [];
    const vistos = new Set();
    
    for (const item of todosLosPermisos) {
      const key = `${item.id_menu}`;
      if (!vistos.has(key)) {
        vistos.add(key);
        menuUnico.push(item);
      }
    }

    // Construir estructura jerárquica
    const menuJerarquico = construirMenuJerarquico(menuUnico);
    
    res.json(menuJerarquico);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener menú por perfil: " + err.message });
  }
}

function construirMenuJerarquico(items) {
  const menuMap = new Map();
  const raiz = [];

  // Primero crear todos los items
  items.forEach(item => {
    menuMap.set(item.id_menu, {
      ...item,
      submenu: []
    });
  });

  // Luego construir la jerarquía
  items.forEach(item => {
    const menuItem = menuMap.get(item.id_menu);
    
    if (item.menu_padre_id === null) {
      raiz.push(menuItem);
    } else {
      const padre = menuMap.get(item.menu_padre_id);
      if (padre) {
        padre.submenu.push(menuItem);
      }
    }
  });

  return raiz;
}

async function crearPermiso(req, res) {
  try {
    const permiso = req.body;
    if (!permiso.id_perfil || !permiso.id_menu) {
      return res.status(400).json({ 
        error: "Datos incompletos. Se requieren id_perfil e id_menu." 
      });
    }
    
    permiso.creado_por = req.usuario?.id_usuario || null;
    const id = await servicioEmpleado.crearPermiso(permiso);
    res.status(201).json({
      message: "Permiso creado correctamente.",
      id
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function actualizarPermiso(req, res) {
  try {
    const permiso = req.body;
    const filas = await servicioEmpleado.actualizarPermiso(req.params.id, permiso);
    if (filas === 0) {
      return res.status(404).json({ error: "Permiso no encontrado para actualizar." });
    }
    res.json({ message: "Permiso actualizado correctamente." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function eliminarPermiso(req, res) {
  try {
    const filas = await servicioEmpleado.eliminarPermiso(req.params.id);
    if (filas === 0) {
      return res.status(404).json({ error: "Permiso no encontrado para eliminar." });
    }
    res.json({ message: "Permiso eliminado correctamente." });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar permiso: " + err.message });
  }
}

// ============= CONTROLADORES DE ASIGNACIÓN DE PERFILES =============

async function asignarPerfilAEmpleado(req, res) {
  try {
    const { id_empleado, id_perfil } = req.body;
    if (!id_empleado || !id_perfil) {
      return res.status(400).json({ 
        error: "Datos incompletos. Se requieren id_empleado e id_perfil." 
      });
    }
    
    const asignadoPor = req.usuario?.id_usuario || null;
    const id = await servicioEmpleado.asignarPerfilAEmpleado(id_empleado, id_perfil, asignadoPor);
    res.status(201).json({
      message: "Perfil asignado correctamente.",
      id
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function removerPerfilDeEmpleado(req, res) {
  try {
    const { id_empleado, id_perfil } = req.body;
    if (!id_empleado || !id_perfil) {
      return res.status(400).json({ 
        error: "Datos incompletos. Se requieren id_empleado e id_perfil." 
      });
    }
    
    const filas = await servicioEmpleado.removerPerfilDeEmpleado(id_empleado, id_perfil);
    if (filas === 0) {
      return res.status(404).json({ error: "Asignación de perfil no encontrada." });
    }
    res.json({ message: "Perfil removido correctamente." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listarPerfilesDeEmpleado(req, res) {
  try {
    const lista = await servicioEmpleado.listarPerfilesDeEmpleado(req.params.idEmpleado);
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: "Error al listar perfiles del empleado: " + err.message });
  }
}

// ============= CONTROLADOR DE AUDITORÍA =============

async function listarAuditoriaPermisos(req, res) {
  try {
    const limite = parseInt(req.query.limite) || 100;
    const lista = await servicioEmpleado.listarAuditoriaPermisos(limite);
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: "Error al listar auditoría de permisos: " + err.message });
  }
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
  obtenerMenuPorPerfil,
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
