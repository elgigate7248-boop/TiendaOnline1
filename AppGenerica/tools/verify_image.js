const pool = require('./db');

async function checkProductImage() {
    try {
        const [rows] = await pool.execute('SELECT imagen FROM producto ORDER BY id_producto DESC LIMIT 1');
        if (rows.length > 0) {
            console.log('Latest Product Image:', rows[0].imagen);
            if (rows[0].imagen === 'https://via.placeholder.com/150') {
                console.log('VERIFICATION PASSED: Image saved correctly.');
            } else {
                console.log('VERIFICATION FAILED: Image does not match.');
            }
        } else {
            console.log('Product not found.');
        }
        process.exit(0);
    } catch (err) {
        console.error('Error checking image:', err.message);
        process.exit(1);
    }
}

checkProductImage();
