const db = require('./db');
const bcrypt = require('bcryptjs');

async function crearAdmin() {
  try {
    // Datos del usuario admin
    const adminData = {
      nombre: 'Administrador',
      email: 'admin@tienda.com',
      password: 'admin123'
    };

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    // Insertar usuario
    const [userResult] = await db.execute(
      'INSERT INTO usuario (nombre, email, contrasena) VALUES (?, ?, ?)',
      [adminData.nombre, adminData.email, hashedPassword]
    );

    const userId = userResult.insertId;
    console.log('✅ Usuario creado con ID:', userId);

    // Obtener rol ADMIN
    const [roleResult] = await db.execute(
      'SELECT id_rol FROM rol WHERE nombre = ?',
      ['ADMIN']
    );

    if (roleResult.length === 0) {
      console.log('❌ Rol ADMIN no encontrado. Creándolo...');
      await db.execute('INSERT INTO rol (nombre) VALUES (?)', ['ADMIN']);
      const [newRoleResult] = await db.execute('SELECT id_rol FROM rol WHERE nombre = ?', ['ADMIN']);
      const roleId = newRoleResult[0].id_rol;
      
      // Asignar rol
      await db.execute(
        'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES (?, ?)',
        [userId, roleId]
      );
      console.log('✅ Rol ADMIN asignado al usuario');
    } else {
      const roleId = roleResult[0].id_rol;
      
      // Asignar rol
      await db.execute(
        'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES (?, ?)',
        [userId, roleId]
      );
      console.log('✅ Rol ADMIN asignado al usuario');
    }

    console.log('\n🎉 Usuario ADMIN creado exitosamente:');
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`🔑 Contraseña: ${adminData.password}`);
    console.log('\n🔐 Usa estas credenciales para iniciar sesión como ADMIN');

  } catch (error) {
    console.error('❌ Error al crear usuario ADMIN:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('⚠️  El email admin@tienda.com ya existe. Intenta con otro email o elimina el usuario existente.');
    }
  } finally {
    process.exit(0);
  }
}

crearAdmin();
