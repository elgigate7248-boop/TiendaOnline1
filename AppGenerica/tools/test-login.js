const fetch = require('node-fetch');

async function testLogin() {
  try {
    const response = await fetch('http://localhost:5000/usuario/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@tienda.com',
        password: 'admin123'
      })
    });

    const data = await response.json();
    console.log('Respuesta del login:', JSON.stringify(data, null, 2));
    
    if (data.usuario && data.usuario.roles) {
      console.log('Roles del usuario:', data.usuario.roles);
      console.log('¿Es ADMIN?', data.usuario.roles.some(r => r.nombre === 'ADMIN'));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();
