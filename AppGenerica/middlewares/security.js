const stores = new Map();

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

function cleanupOldEntries(store, windowMs, now) {
  for (const [key, info] of store.entries()) {
    if (now - info.windowStart > windowMs) {
      store.delete(key);
    }
  }
}

function createRateLimiter({
  id = 'default',
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Demasiadas solicitudes. Intenta más tarde.',
  keySelector
}) {
  const store = new Map();
  stores.set(id, store);

  let requestsSinceCleanup = 0;

  return (req, res, next) => {
    const now = Date.now();
    const key = typeof keySelector === 'function'
      ? keySelector(req)
      : (req.ip || req.socket?.remoteAddress || 'unknown');

    let entry = store.get(key);
    if (!entry || (now - entry.windowStart) > windowMs) {
      entry = { count: 0, windowStart: now };
      store.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      return res.status(429).json({ error: message });
    }

    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 500) {
      cleanupOldEntries(store, windowMs, now);
      requestsSinceCleanup = 0;
    }

    next();
  };
}

module.exports = {
  securityHeaders,
  createRateLimiter
};

