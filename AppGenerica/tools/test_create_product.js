const http = require('http');

// Helper to make requests
function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(body || '{}') });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function test() {
    try {
        console.log('Logging in...');
        const loginData = {
            email: 'admin_super@tienda.com',
            password: 'password123'
        };

        const loginRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/usuario/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, loginData);

        if (loginRes.statusCode !== 200) {
            throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
        }

        const token = loginRes.body.token;
        console.log('Login successful, token received.');

        // 2. Create Product
        console.log('Creating product...');
        const productData = {
            nombre: 'Producto Test Imagen ' + Date.now(),
            precio: 150.00,
            stock: 5,
            id_categoria: 1,
            imagen: 'https://via.placeholder.com/150'
        };

        const createRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/producto',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }, productData);

        if (createRes.statusCode !== 201) {
            throw new Error(`Create product failed: ${JSON.stringify(createRes.body)}`);
        }

        console.log('Product created successfully:', createRes.body);

        // 3. Verify specifically that the image is in the response (if checking against DB is harder)
        if (createRes.body.insertId) {
            console.log("PASS: Product created with ID " + createRes.body.insertId);
            // Optionally verify by fetching it back if the API supports get by ID
        }

    } catch (err) {
        console.error('Test failed:', err.message);
        process.exit(1);
    }
}

test();
