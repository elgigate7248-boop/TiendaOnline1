const express = require("express");
require("express-async-errors");
const cors = require("cors");
const path = require("path");
const { securityHeaders, createRateLimiter } = require("./middlewares/security");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'supersecreto') {
  console.warn('\n⚠️  ADVERTENCIA: JWT_SECRET no configurado o es el valor por defecto.');
  console.warn('   Configura una clave segura en las variables de entorno para producción.\n');
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ JWT_SECRET inseguro en producción. Abortando.');
    process.exit(1);
  }
}

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors(
  (isProduction && allowedOrigins.length)
    ? {
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error('Origen no permitido por CORS'));
        },
        credentials: true
      }
    : { credentials: true }
));

app.use(securityHeaders);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '3mb' }));

const apiRateLimiter = createRateLimiter({
  id: 'api-global',
  windowMs: Number(process.env.API_RATE_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.API_RATE_MAX || 400),
  message: 'Has enviado demasiadas solicitudes. Intenta nuevamente en unos minutos.'
});
app.use(apiRateLimiter);


const frontendDir = path.join(__dirname, "..", "frontend-html");
app.use("/frontend-html", express.static(frontendDir));


const usuarioRutas = require("./rutas/Usuario.rutas.js");
const direccionRutas = require("./rutas/Direccion.rutas.js");
const productoRutas = require("./rutas/Producto.rutas.js");
const categoriaRutas = require("./rutas/Categoria.rutas.js");
const pedidoRutas = require("./rutas/Pedido.rutas.js");
const estadoPedidoRutas = require("./rutas/Estado_pedido.rutas.js");
const detallePedidoRutas = require("./rutas/Detalle_pedido.rutas.js");
const pagoRutas = require("./rutas/Pago.rutas.js");
const resenaRutas = require("./rutas/Resena.rutas.js");
const usuarioRolRutas = require("./rutas/UsuarioRol.rutas.js");
const vendedorSolicitudRutas = require("./rutas/VendedorSolicitud.rutas.js");
const repartidorSolicitudRutas = require("./rutas/RepartidorSolicitud.rutas.js");
const empleadoRutas = require("./rutas/Empleado.rutas.js");
const paymentRutas = require("./rutas/Payment.rutas.js");
const emailRutas = require("./rutas/Email.rutas.js");
const analyticsRutas = require("./rutas/Analytics.rutas.js");
const kardexRutas = require("./rutas/Kardex.rutas.js");
const ubicacionRutas = require("./rutas/Ubicacion.rutas.js");
const movimientoInventarioRutas = require("./rutas/MovimientoInventario.rutas.js");
const reportesRutas = require("./rutas/Reportes.rutas.js");

// Asignar rutas
app.use("/usuario", usuarioRutas);
app.use("/direccion", direccionRutas);
app.use("/categoria", categoriaRutas);
app.use("/producto", productoRutas);
app.use("/pedido", pedidoRutas);
app.use("/estado-pedido", estadoPedidoRutas);
app.use("/detalle-pedido", detallePedidoRutas);
app.use("/pago", pagoRutas);
app.use("/resena", resenaRutas);
app.use("/usuario-rol", usuarioRolRutas);
app.use("/vendedor-solicitud", vendedorSolicitudRutas);
app.use("/repartidor-solicitud", repartidorSolicitudRutas);
app.use("/empleado", empleadoRutas);
app.use("/payment", paymentRutas);
app.use("/email", emailRutas);
app.use("/analytics", analyticsRutas);
app.use("/kardex", kardexRutas);
app.use("/ubicacion", ubicacionRutas);
app.use("/movimiento-inventario", movimientoInventarioRutas);
app.use("/reportes", reportesRutas);

// Ruta raíz
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "API funcionando correctamente ",
    endpoints: [
      "/frontend-html/index.html",
      "/usuario",
      "/direccion",
      "/categoria",
      "/producto",
      "/pedido",
      "/estado-pedido",
      "/detalle-pedido",
      "/pago",
      "/resena",
      "/usuario-rol",
      "/vendedor-solicitud",
      "/repartidor-solicitud",
      "/empleado",
      "/payment",
      "/email",
      "/analytics",
      "/kardex",
      "/ubicacion",
      "/movimiento-inventario",
      "/reportes"
    ]
  });
});


app.use((req, res) => {
  console.log(` 404 - ${req.method} ${req.path}`);
  res.status(404).json({
    error: "Ruta no encontrada",
    method: req.method,
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    error: isProduction ? 'Error interno del servidor' : (err.message || 'Error interno del servidor')
  });
});


app.listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════╗");
  console.log(`║   API corriendo en puerto ${PORT}   ║`);
  console.log("╚══════════════════════════════════════╝");
  console.log(` http://localhost:${PORT}`);
});
