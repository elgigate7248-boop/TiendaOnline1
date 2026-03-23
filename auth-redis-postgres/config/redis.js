// ── Conexión a Redis ─────────────────────────────────────────────────────────
const Redis = require('ioredis');

const redis = new Redis({
  host:     process.env.REDIS_HOST     || '127.0.0.1',
  port:     process.env.REDIS_PORT     || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db:       process.env.REDIS_DB       || 0,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    console.log(`🔄 Reintentando conexión a Redis (intento ${times})...`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  lazyConnect: false
});

redis.on('connect', () => {
  console.log('✅ Redis conectado');
});

redis.on('error', (err) => {
  console.error('❌ Error en Redis:', err.message);
});

// TTL por defecto para usuarios en caché (en segundos)
const USER_CACHE_TTL = parseInt(process.env.REDIS_USER_TTL) || 3600; // 1 hora

/**
 * Verifica la conexión a Redis
 */
async function testConnection() {
  try {
    await redis.ping();
    console.log('✅ Conexión a Redis verificada (PONG)');
    return true;
  } catch (err) {
    console.error('❌ No se pudo conectar a Redis:', err.message);
    return false;
  }
}

module.exports = { redis, USER_CACHE_TTL, testConnection };
