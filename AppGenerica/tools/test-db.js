const db = require('./db.js');

console.log('🧪 Test de conexión a base de datos...');

db.getConnection()
  .then(connection => {
    console.log('✅ Base de datos conectada correctamente');
    
    return connection.execute('SELECT COUNT(*) as count FROM usuario');
  })
  .then(([result]) => {
    console.log(`📊 Total usuarios: ${result[0].count}`);
    
    return db.execute('SELECT COUNT(*) as count FROM producto');
  })
  .then(([result]) => {
    console.log(`📦 Total productos: ${result[0].count}`);
    
    return db.execute('SELECT COUNT(*) as count FROM pedido');
  })
  .then(([result]) => {
    console.log(`🛒 Total pedidos: ${result[0].count}`);
    console.log('🎉 Todas las pruebas de base de datos pasaron exitosamente');
  })
  .catch(error => {
    console.error('❌ Error en prueba de base de datos:', error.message);
  })
  .finally(() => {
    process.exit(0);
  });
