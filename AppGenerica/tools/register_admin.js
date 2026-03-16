const http = require('http');

const data = JSON.stringify({
    nombre: 'Admin Test',
    email: 'admin_test_' + Date.now() + '@tienda.com', // Unique email
    password: 'password123',
    telefono: '1234567890',
    direccion: 'Calle Falsa 123',
    rol: 'ADMIN' // Trying to register as ADMIN directly. 
    // If the backend prevents this (often roles are defaulted to CLIENT), 
    // I might need to insert into DB directly.
    // Let's check Usuario.controlador.js or just try. 
    // Usually registration endpoints don't allow setting role ADMIN for security.
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/usuario/registro',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Body:', body);

        // If registration fails or ignores role, I will use a direct DB insert script.
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
