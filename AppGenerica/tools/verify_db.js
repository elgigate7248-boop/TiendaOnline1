const pool = require('./db');

async function verify() {
    try {
        const [tables] = await pool.execute('SHOW TABLES');
        console.log('Tables in database:', tables.map(t => Object.values(t)[0]));

        const [colsPedido] = await pool.execute('DESCRIBE pedido');
        console.log('Columns in pedido:', colsPedido.map(c => c.Field));

        const [colsDetalle] = await pool.execute('DESCRIBE detalle_pedido');
        console.log('Columns in detalle_pedido:', colsDetalle.map(c => c.Field));

        process.exit(0);
    } catch (err) {
        console.error('Error during verification:', err.message);
        process.exit(1);
    }
}

verify();
