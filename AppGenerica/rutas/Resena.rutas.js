const express = require("express");
const router = express.Router();

const controlador = require("../controlador/Resena.controlador");
const { verificarToken, requiereRol } = require("../middlewares/auth");

router.get("/producto/:idProducto", controlador.obtenerResenasPorProducto);

router.post(
  "/producto/:idProducto",
  verificarToken,
  requiereRol(["CLIENTE"]),
  controlador.crearResena
);

// Vendor ratings
router.get("/vendedores/ratings", controlador.obtenerRatingsVendedores);
router.get("/vendedor/:idVendedor", controlador.obtenerResenasPorVendedor);

module.exports = router;
