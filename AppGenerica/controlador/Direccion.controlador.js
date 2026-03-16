const servicio = require('../servicios/Direccion.servicios');

exports.obtenerDirecciones = async (req, res) => {
  try {
    console.log('📋 GET /direccion - Listando direcciones');
    const direcciones = await servicio.listar();
    console.log(`✅ ${direcciones.length} direcciones encontradas`);
    res.json(direcciones);
  } catch (err) {
    console.error('❌ Error al obtener direcciones:', err.message);
    res.status(500).json({ error: 'Error al obtener direcciones' });
  }
};

exports.crearDireccion = async (req, res) => {
  console.log('📥 Controlador recibió:', req.body);
  try {
    // ⭐ Extraer campos (soportar ambas formas)
    const id_usuario = req.body.id_usuario || req.body.IdUsuario;
    const ciudad = req.body.ciudad || req.body.Ciudad;
    const codigo_postal = req.body.codigo_postal || req.body.CodigoPostal;

    console.log('📦 Datos extraídos:', { id_usuario, ciudad, codigo_postal });

    // ⭐ Validación mínima
    if (!id_usuario) {
      console.log('❌ id_usuario vacío o undefined');
      return res.status(400).json({
        error: 'El id_usuario es obligatorio',
        recibido: req.body
      });
    }

    const resultado = await servicio.insertar({
      id_usuario,
      ciudad,
      codigo_postal
    });

    console.log('✅ Resultado del servicio:', resultado);
    res.status(201).json(resultado);
  } catch (err) {
    console.error('❌ Error en controlador:', err.message);
    console.error(err.stack);
    res.status(500).json({
      error: 'Error al registrar dirección',
      detalle: err.message
    });
  }
};

exports.actualizarDireccion = async (req, res) => {
  console.log(`📝 PUT /direccion/${req.params.id} - Datos:`, req.body);
  try {
    const { id } = req.params;
    const ciudad = req.body.ciudad || req.body.Ciudad;
    const codigo_postal = req.body.codigo_postal || req.body.CodigoPostal;

    if (!ciudad && !codigo_postal) {
      return res.status(400).json({
        error: 'Debe enviar al menos un campo para actualizar'
      });
    }

    const resultado = await servicio.actualizar(id, {
      ciudad,
      codigo_postal
    });

    console.log('✅ Dirección actualizada');
    res.json({
      id_direccion: parseInt(id),
      ciudad,
      codigo_postal
    });
  } catch (err) {
    console.error('❌ Error al actualizar dirección:', err.message);
    res.status(500).json({ error: 'Error al actualizar dirección' });
  }
};

exports.eliminarDireccion = async (req, res) => {
  console.log(`🗑️ DELETE /direccion/${req.params.id}`);
  try {
    const resultado = await servicio.eliminar(req.params.id);
    console.log('✅ Dirección eliminada');
    res.json({ mensaje: 'Dirección eliminada correctamente' });
  } catch (err) {
    console.error('❌ Error al eliminar dirección:', err.message);
    res.status(500).json({ error: 'Error al eliminar dirección' });
  }
};
