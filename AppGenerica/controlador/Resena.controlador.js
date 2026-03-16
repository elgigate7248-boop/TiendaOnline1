const servicio = require("../servicios/Resena.servicios");

exports.obtenerResenasPorProducto = async (req, res) => {
  try {
    const { idProducto } = req.params;
    const rows = await servicio.listarPorProducto(idProducto);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener reseñas: " + err.message });
  }
};

exports.crearResena = async (req, res) => {
  try {
    const { idProducto } = req.params;
    const idUsuario = req.usuario?.id;
    if (!idUsuario) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const { rating, comentario } = req.body;

    const resultado = await servicio.insertar({
      id_producto: idProducto,
      id_usuario: idUsuario,
      rating,
      comentario
    });

    res.status(201).json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.obtenerRatingsVendedores = async (req, res) => {
  try {
    const rows = await servicio.ratingPorVendedor();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener ratings: " + err.message });
  }
};

exports.obtenerResenasPorVendedor = async (req, res) => {
  try {
    const { idVendedor } = req.params;
    const rows = await servicio.resenasPorVendedor(idVendedor);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener reseñas del vendedor: " + err.message });
  }
};
