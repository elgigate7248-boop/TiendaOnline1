const db = require('./db');
const bcrypt = require('bcryptjs');

async function resetDatabase() {
  try {
    console.log('🔄 Iniciando reset de la base de datos...');

    // 1. Borrar primero las asignaciones de roles (por la clave foránea)
    console.log('🗑️ Borrando asignaciones de roles...');
    await db.execute('DELETE FROM usuario_rol');
    console.log('✅ Asignaciones de roles borradas');

    // 2. Borrar todos los usuarios
    console.log('🗑️ Borrando todos los usuarios...');
    await db.execute('DELETE FROM usuario');
    console.log('✅ Usuarios borrados');

    // 3. Crear usuario ADMIN
    console.log('👤 Creando usuario ADMIN...');
    const adminData = {
      nombre: 'Administrador Principal',
      email: 'admin@tienda.com',
      password: 'admin123'
    };

    const hashedPassword = await bcrypt.hash(adminData.password, 10);
    
    const [userResult] = await db.execute(
      'INSERT INTO usuario (nombre, email, contrasena) VALUES (?, ?, ?)',
      [adminData.nombre, adminData.email, hashedPassword]
    );

    const adminId = userResult.insertId;
    console.log(`✅ Usuario ADMIN creado con ID: ${adminId}`);

    // 4. Asignar rol ADMIN
    console.log('🔐 Asignando rol ADMIN...');
    const [roleResult] = await db.execute(
      'SELECT id_rol FROM rol WHERE nombre = ?',
      ['ADMIN']
    );

    if (roleResult.length === 0) {
      console.log('❌ Rol ADMIN no encontrado. Creándolo...');
      await db.execute('INSERT INTO rol (nombre) VALUES (?)', ['ADMIN']);
      const [newRoleResult] = await db.execute('SELECT id_rol FROM rol WHERE nombre = ?', ['ADMIN']);
      const roleId = newRoleResult[0].id_rol;
      
      await db.execute(
        'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES (?, ?)',
        [adminId, roleId]
      );
      console.log('✅ Rol ADMIN creado y asignado');
    } else {
      const roleId = roleResult[0].id_rol;
      
      await db.execute(
        'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES (?, ?)',
        [adminId, roleId]
      );
      console.log('✅ Rol ADMIN asignado al usuario');
    }

    // 5. Verificar resultado
    console.log('\n🎉 Reset completado!');
    console.log('📋 Nuevo usuario ADMIN:');
    console.log(`   📧 Email: ${adminData.email}`);
    console.log(`   🔑 Contraseña: ${adminData.password}`);
    console.log(`   🆔 ID: ${adminId}`);
    console.log(`   🔐 Rol: ADMIN`);
    console.log('\n🚀 Ya puedes iniciar sesión en el panel de administración.');

  } catch (error) {
    console.error('❌ Error durante el reset:', error);
  } finally {
    process.exit(0);
  }
}

resetDatabase();
