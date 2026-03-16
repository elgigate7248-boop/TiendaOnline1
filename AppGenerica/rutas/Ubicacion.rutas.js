const express = require('express');
const router = express.Router();
const controlador = require('../controlador/Ubicacion.controlador');

router.get('/departamentos', controlador.obtenerDepartamentos);
router.get('/ciudades', controlador.obtenerCiudades);

module.exports = router;
