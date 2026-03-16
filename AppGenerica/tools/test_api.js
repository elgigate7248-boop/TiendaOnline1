const pool = require('./db');

async function testApi() {
    try {
        const [users] = await pool.execute('SELECT id_usuario, nombre, email, rol FROM usuario');
        console.log('Users found:', users);

        const [products] = await pool.execute('SELECT * FROM producto LIMIT 5');
        console.log('Sample products:', products);

        const [categories] = await pool.execute('SELECT * FROM categoria');
        console.log('Categories:', categories);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

testApi();
