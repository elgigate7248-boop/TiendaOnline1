const pool = require('./db');

async function checkSchema() {
    try {
        const [cols] = await pool.execute('DESCRIBE usuario');
        console.log('Columns in usuario:', cols.map(c => c.Field));
        process.exit(0);
    } catch (err) {
        console.error('Error checking schema:', err.message);
        process.exit(1);
    }
}

checkSchema();
