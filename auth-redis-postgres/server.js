// ── Entry Point ─────────────────────────────────────────────────────────────
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const authRoutes = require('./routes/auth.routes');
const { testConnection: testMySQL }  = require('./config/db');
const { testConnection: testRedis } = require('./config/redis');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middlewares globales ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Rutas ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', async (_req, res) => {
  const mysql = await testMySQL();
  const redis = await testRedis();
  res.json({
    status:     mysql && redis ? 'OK' : 'DEGRADED',
    mysql:      mysql ? 'connected' : 'disconnected',
    redis:      redis ? 'connected' : 'disconnected',
    uptime:     process.uptime()
  });
});

// ── Manejo global de errores ─────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(' Error no manejado:', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

// ── Arranque ─────────────────────────────────────────────────────────────────
async function iniciar() {
  console.log('\n🔧 Verificando conexiones...\n');
  await testMySQL();
  await testRedis();

  app.listen(PORT, () => {
    console.log(`\n Servidor de autenticación corriendo en http://localhost:${PORT}`);
    console.log(`   POST  /api/auth/login`);
    console.log(`   POST  /api/auth/registro`);
    console.log(`   POST  /api/auth/logout    (requiere token)`);
    console.log(`   GET   /api/auth/perfil    (requiere token)`);
    console.log(`   GET   /health\n`);
  });
}

iniciar();
