const pool = require('./db');

async function checkData() {
    try {
        const [rows] = await pool.query('SELECT * FROM producto');
        console.log(`Found ${rows.length} products.`);
        if (rows.length > 0) {
            console.log('Sample product:', rows[0]);
        }
        process.exit(0);
    } catch (err) {
        console.error('Error checking data:', err.message);
        process.exit(1);
    }
}

checkData();
