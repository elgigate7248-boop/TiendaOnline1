const pool = require('./db');

async function checkRoles() {
    try {
        const [roles] = await pool.execute('SELECT * FROM rol');
        console.log('Roles:', roles);
        process.exit(0);
    } catch (err) {
        console.error('Error checking roles:', err.message);
        // If table doesn't exist, we'll know
        process.exit(1);
    }
}

checkRoles();
