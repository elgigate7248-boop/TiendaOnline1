const pool = require('./db');
const bcrypt = require('bcryptjs');

async function createAdmin() {
    try {
        const email = 'admin_super@tienda.com';
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 8);

        // Check if user exists
        const [existing] = await pool.execute('SELECT * FROM usuario WHERE email = ?', [email]);
        let userId;

        if (existing.length > 0) {
            console.log('User already exists');
            userId = existing[0].id_usuario;
        } else {
            // Insert new user
            // Rol column removed from insert because it's handled via relation
            const [res] = await pool.execute(
                "INSERT INTO usuario (nombre, email, contrasena, telefono) VALUES (?, ?, ?, ?)",
                ['Super Admin', email, hashedPassword, '0000000000']
            );
            userId = res.insertId;
            console.log('User created with ID:', userId);
        }

        // Get ID for ADMIN role
        const [roles] = await pool.execute("SELECT id_rol FROM rol WHERE nombre = 'ADMIN'");
        if (roles.length === 0) {
            // Create role if not exists
            const [rolRes] = await pool.execute("INSERT INTO rol (nombre) VALUES ('ADMIN')");
            console.log('ADMIN role created');
            await pool.execute("INSERT INTO usuario_rol (id_usuario, id_rol) VALUES (?, ?)", [userId, rolRes.insertId]);
        } else {
            const roleId = roles[0].id_rol;
            // Check if already has role
            const [hasRole] = await pool.execute("SELECT * FROM usuario_rol WHERE id_usuario = ? AND id_rol = ?", [userId, roleId]);
            if (hasRole.length === 0) {
                await pool.execute("INSERT INTO usuario_rol (id_usuario, id_rol) VALUES (?, ?)", [userId, roleId]);
                console.log('Role assigned');
            } else {
                console.log('User already has ADMIN role');
            }
        }

        console.log(`Credentials: ${email} / ${password}`);
        process.exit(0);

    } catch (err) {
        console.error('Error creating admin:', err.message);
        process.exit(1);
    }
}

createAdmin();
