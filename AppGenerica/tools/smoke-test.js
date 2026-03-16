const http = require('http');

const BASE = 'http://localhost:5000';

function request(method, path, body, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', (e) => resolve({ status: 0, json: null, error: e.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const results = [];
  const ok = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? '✅' : '❌'} ${name} ${detail || ''}`);
  };

  // 1. Login
  const login = await request('POST', '/usuario/login', { email: 'admin@tienda.com', password: 'admin123' });
  const token = login.json?.token;
  ok('Login admin', login.status === 200 && !!token, `status=${login.status}`);
  if (!token) { console.log('⛔ No token, aborting'); process.exit(1); }

  const auth = { Authorization: 'Bearer ' + token };

  // 2. GET /producto (public)
  const prod = await request('GET', '/producto', null);
  ok('GET /producto (public)', prod.status === 200, `status=${prod.status} count=${Array.isArray(prod.json) ? prod.json.length : '?'}`);

  // 3. GET /categoria (public)
  const cat = await request('GET', '/categoria', null);
  ok('GET /categoria (public)', cat.status === 200, `status=${cat.status} count=${Array.isArray(cat.json) ? cat.json.length : '?'}`);

  // 4. GET /usuario (ADMIN)
  const usr = await request('GET', '/usuario', null, auth);
  ok('GET /usuario (ADMIN)', usr.status === 200, `status=${usr.status} count=${Array.isArray(usr.json) ? usr.json.length : '?'}`);

  // 5. GET /pedido (ADMIN)
  const ped = await request('GET', '/pedido', null, auth);
  ok('GET /pedido (ADMIN)', ped.status === 200, `status=${ped.status} count=${Array.isArray(ped.json) ? ped.json.length : '?'}`);

  // 6. GET /usuario-rol (ADMIN)
  const roles = await request('GET', '/usuario-rol', null, auth);
  ok('GET /usuario-rol (ADMIN)', roles.status === 200, `status=${roles.status} count=${Array.isArray(roles.json) ? roles.json.length : '?'}`);

  // 7. GET /vendedor-solicitud (ADMIN)
  const vs = await request('GET', '/vendedor-solicitud', null, auth);
  ok('GET /vendedor-solicitud (ADMIN)', vs.status === 200, `status=${vs.status} count=${Array.isArray(vs.json) ? vs.json.length : '?'}`);

  // 8. GET /vendedor-solicitud/mia (ADMIN can also call)
  const vsMia = await request('GET', '/vendedor-solicitud/mia', null, auth);
  ok('GET /vendedor-solicitud/mia', vsMia.status === 200, `status=${vsMia.status}`);

  // 9. GET /direccion
  const dir = await request('GET', '/direccion', null, auth);
  ok('GET /direccion', dir.status === 200, `status=${dir.status}`);

  // 10. GET /pago
  const pago = await request('GET', '/pago', null, auth);
  ok('GET /pago', pago.status === 200, `status=${pago.status}`);

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n📊 Resultado: ${passed}/${results.length} pasaron, ${failed} fallaron`);
  if (failed) {
    console.log('❌ Tests fallidos:');
    results.filter(r => !r.pass).forEach(r => console.log(`   - ${r.name}: ${r.detail}`));
  } else {
    console.log('🎉 Todos los endpoints funcionan correctamente!');
  }
  process.exit(failed ? 1 : 0);
}

run();
