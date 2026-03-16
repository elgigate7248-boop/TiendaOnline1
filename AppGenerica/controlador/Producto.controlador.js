const servicio = require('../servicios/Producto.servicios');

async function obtenerProductos(req, res) {
  try {
    const productos = await servicio.listar();
    res.json(productos);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener productos", error });
  }
}

async function obtenerProductosGestion(req, res) {
  try {
    const roles = Array.isArray(req.usuario?.roles)
      ? req.usuario.roles.map(r => String(r || '').trim().toUpperCase())
      : [];
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    const esVendedor = roles.includes('VENDEDOR');

    if (esAdmin) {
      const productos = await servicio.listar();
      return res.json(productos);
    }

    if (esVendedor) {
      const productos = await servicio.listarPorVendedor(req.usuario.id_usuario);
      return res.json(productos);
    }

    return res.status(403).json({ mensaje: 'No tienes permisos para gestionar productos' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener productos para gestión', error: error.message });
  }
}

async function obtenerProducto(req, res) {
  const { id } = req.params;
  try {
    const producto = await servicio.buscarPorId(id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }
    res.json(producto);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener producto", error });
  }
}

async function crearProducto(req, res) {
  try {
    const idVendedor = req.usuario?.id_usuario || null;
    const nuevoId = await servicio.crearProducto(req.body, idVendedor);
    res.status(201).json({ id: nuevoId, mensaje: "Producto creado" });
  } catch (error) {
    res.status(error.status || 500).json({ mensaje: error.message || "Error al crear producto" });
  }
}

async function obtenerAtributos(req, res) {
  try {
    const atributos = await servicio.obtenerAtributosPorProducto(req.params.id);
    res.json(atributos);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener atributos", error });
  }
}

async function guardarAtributos(req, res) {
  try {
    await servicio.reemplazarAtributos(req.params.id, req.body);
    res.json({ mensaje: "Atributos guardados" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al guardar atributos", error });
  }
}

async function obtenerMasVendidosPorCategoria(req, res) {
  try {
    const { idCategoria } = req.params;
    const limit = req.query.limit;
    const rows = await servicio.masVendidosPorCategoria(idCategoria, limit);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error al obtener más vendidos:', err.message);
    res.status(500).json({ error: 'Error al obtener más vendidos' });
  }
};

module.exports = {
  obtenerProductos,
  obtenerProductosGestion,
  obtenerProducto,
  crearProducto,
  obtenerAtributos,
  guardarAtributos,
  obtenerMasVendidosPorCategoria
};
