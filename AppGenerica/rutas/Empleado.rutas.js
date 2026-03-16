const express = require('express');
const router = express.Router();
const ctrl = require('../controlador/Empleado.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');

// ============= RUTAS DE EMPLEADOS =============

// Listar todos los empleados (requiere rol de administrador o RRHH)
router.get('/empleados', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'RECURSOS_HUMANOS']), ctrl.listarEmpleados);

// Buscar empleado por ID (requiere rol de administrador o RRHH)
router.get('/empleados/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'RECURSOS_HUMANOS']), ctrl.buscarEmpleadoPorId);

// Crear nuevo empleado (requiere rol de administrador o RRHH)
router.post('/empleados', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'RECURSOS_HUMANOS']), ctrl.crearEmpleado);

// Actualizar empleado (requiere rol de administrador o RRHH)
router.put('/empleados/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'RECURSOS_HUMANOS']), ctrl.actualizarEmpleado);

// Eliminar empleado (requiere rol de administrador)
router.delete('/empleados/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.eliminarEmpleado);

// ============= RUTAS DE ROLES DE EMPLEADO =============

// Listar todos los roles de empleado (requiere rol de administrador o RRHH)
router.get('/roles-empleado', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'RECURSOS_HUMANOS']), ctrl.listarRolesEmpleado);

// Crear nuevo rol de empleado (requiere rol de administrador)
router.post('/roles-empleado', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.crearRolEmpleado);

// Actualizar rol de empleado (requiere rol de administrador)
router.put('/roles-empleado/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.actualizarRolEmpleado);

// Eliminar rol de empleado (requiere rol de administrador)
router.delete('/roles-empleado/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.eliminarRolEmpleado);

// ============= RUTAS DE PERFILES =============

// Listar todos los perfiles (requiere rol de administrador o RRHH)
router.get('/perfiles', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'RECURSOS_HUMANOS']), ctrl.listarPerfiles);

// Listar perfiles por rol de empleado (requiere rol de administrador o RRHH)
router.get('/perfiles/rol/:idRol', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'RECURSOS_HUMANOS']), ctrl.listarPerfilesPorRol);

// Crear nuevo perfil (requiere rol de administrador)
router.post('/perfiles', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.crearPerfil);

// Actualizar perfil (requiere rol de administrador)
router.put('/perfiles/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.actualizarPerfil);

// Eliminar perfil (requiere rol de administrador)
router.delete('/perfiles/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.eliminarPerfil);

// ============= RUTAS DE MENÚ DE NAVEGACIÓN =============

// Listar todo el menú de navegación (requiere rol de administrador)
router.get('/menu', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.listarMenuNavegacion);

// Crear nueva opción de menú (requiere rol de administrador)
router.post('/menu', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.crearMenuOpcion);

// Actualizar opción de menú (requiere rol de administrador)
router.put('/menu/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.actualizarMenuOpcion);

// Eliminar opción de menú (requiere rol de administrador)
router.delete('/menu/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.eliminarMenuOpcion);

// ============= RUTAS DE PERMISOS =============

// Listar permisos por perfil (requiere rol de administrador)
router.get('/permisos/perfil/:idPerfil', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.listarPermisosPorPerfil);

// Obtener menú dinámico para el usuario actual (requiere estar autenticado)
router.get('/menu-usuario', verificarToken, ctrl.obtenerMenuPorPerfil);

// Crear nuevo permiso (requiere rol de administrador)
router.post('/permisos', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.crearPermiso);

// Actualizar permiso (requiere rol de administrador)
router.put('/permisos/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.actualizarPermiso);

// Eliminar permiso (requiere rol de administrador)
router.delete('/permisos/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.eliminarPermiso);

// ============= RUTAS DE ASIGNACIÓN DE PERFILES =============

// Asignar perfil a empleado (requiere rol de administrador o RRHH)
router.post('/asignar-perfil', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'RECURSOS_HUMANOS']), ctrl.asignarPerfilAEmpleado);

// Remover perfil de empleado (requiere rol de administrador o RRHH)
router.post('/remover-perfil', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'RECURSOS_HUMANOS']), ctrl.removerPerfilDeEmpleado);

// Listar perfiles asignados a un empleado (requiere rol de administrador o RRHH)
router.get('/empleado/:idEmpleado/perfiles', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'RECURSOS_HUMANOS']), ctrl.listarPerfilesDeEmpleado);

// ============= RUTAS DE AUDITORÍA =============

// Listar auditoría de permisos (requiere rol de administrador)
router.get('/auditoria/permisos', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.listarAuditoriaPermisos);

module.exports = router;
