const express = require("express");
const router = express.Router();

const controlador = require("../controlador/Resena.controlador");
const autenticacion = require("../middlewares/Autenticacion");
const autorizarRol = require("../middlewares/AutorizarRol");

router.get("/producto/:idProducto", controlador.obtenerResenasPorProducto);

router.post(
  "/producto/:idProducto",
  autenticacion,
  autorizarRol(["CLIENTE"]),
  controlador.crearResena
);

// Vendor ratings
router.get("/vendedores/ratings", controlador.obtenerRatingsVendedores);
router.get("/vendedor/:idVendedor", controlador.obtenerResenasPorVendedor);

module.exports = router;
