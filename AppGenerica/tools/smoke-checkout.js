const http = require('http');

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:5000';

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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, json, raw: data });
      });
    });

    req.on('error', (err) => resolve({ status: 0, json: null, error: err.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assertOrThrow(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const timestamp = Date.now();
  const email = `smoke.cliente.${timestamp}@test.local`;
  const password = 'Smoke1234!';
  const nombre = `Smoke Cliente ${timestamp}`;

  console.log('🧪 Iniciando smoke test de checkout...');
  console.log(`🌐 Base URL: ${BASE}`);

  // 1) Registro de cliente
  const registro = await request('POST', '/usuario/registro', { nombre, email, password });
  assertOrThrow(
    registro.status === 201,
    `Registro falló (status=${registro.status}) ${registro.json?.error || registro.raw || ''}`
  );
  console.log('✅ Registro cliente');

  // 2) Login cliente
  const login = await request('POST', '/usuario/login', { email, password });
  assertOrThrow(
    login.status === 200 && !!login.json?.token,
    `Login cliente falló (status=${login.status}) ${login.json?.error || login.raw || ''}`
  );
  const token = login.json.token;
  const roles = Array.isArray(login.json?.usuario?.roles)
    ? login.json.usuario.roles.map((r) => (r && typeof r === 'object') ? r.nombre : r)
    : [];
  assertOrThrow(roles.includes('CLIENTE'), `Usuario de smoke no tiene rol CLIENTE (${roles.join(', ')})`);
  console.log('✅ Login cliente');

  // 3) Buscar un producto con stock disponible
  const productosRes = await request('GET', '/producto');
  assertOrThrow(productosRes.status === 200 && Array.isArray(productosRes.json), 'No se pudo obtener catálogo de productos');
  const producto = productosRes.json.find((p) => Number(p.stock) > 0);
  assertOrThrow(!!producto, 'No hay productos con stock disponible para probar checkout');
  const idProducto = producto.id_producto || producto.id;
  const precio = Number(producto.precio) || 0;
  assertOrThrow(!!idProducto && precio > 0, 'Producto inválido para pruebas de checkout');
  console.log(`✅ Producto para test: id=${idProducto}, precio=${precio}`);

  // 4) Crear pedido de checkout como cliente autenticado
  const pedidoBody = {
    id_estado: 1,
    metodo_pago: 'efectivo',
    detalles: [
      {
        id_producto: idProducto,
        cantidad: 1,
        precio_unitario: precio
      }
    ]
  };

  const pedidoRes = await request('POST', '/pedido', pedidoBody, { Authorization: `Bearer ${token}` });
  assertOrThrow(
    pedidoRes.status === 201 && !!pedidoRes.json?.insertId,
    `Crear pedido falló (status=${pedidoRes.status}) ${pedidoRes.json?.error || pedidoRes.raw || ''}`
  );
  const idPedido = pedidoRes.json.insertId;
  console.log(`✅ Pedido creado: id=${idPedido}`);

  // 5) Validar que aparece en "mis pedidos"
  const misPedidos = await request('GET', '/pedido/mis-pedidos', null, { Authorization: `Bearer ${token}` });
  assertOrThrow(
    misPedidos.status === 200 && Array.isArray(misPedidos.json),
    `Mis pedidos falló (status=${misPedidos.status}) ${misPedidos.json?.error || misPedidos.raw || ''}`
  );
  const existe = misPedidos.json.some((p) => String(p.id_pedido || p.id) === String(idPedido));
  assertOrThrow(existe, 'El pedido creado no aparece en /pedido/mis-pedidos');
  console.log('✅ Validación en mis pedidos');

  console.log('\n🎉 Smoke checkout OK: registro -> login -> pedido -> mis pedidos');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n❌ Smoke checkout falló: ${err.message}`);
    process.exit(1);
  });

