const pool = require('./db');

async function seed() {
    try {
        // Categorías
        const [catRes] = await pool.execute("INSERT INTO categoria (nombre) VALUES ('Electrónica'), ('Ropa'), ('Hogar')");
        const idCat1 = catRes.insertId;
        const idCat2 = idCat1 + 1;
        const idCat3 = idCat1 + 2;

        // Productos
        const products = [
            ['Smartphone X', 799.99, 10, idCat1, 'https://placehold.co/600x400?text=Smartphone'],
            ['Laptop Pro', 1299.99, 5, idCat1, 'https://placehold.co/600x400?text=Laptop'],
            ['Camiseta Algodón', 19.99, 50, idCat2, 'https://placehold.co/600x400?text=Camiseta'],
            ['Sofá Confort', 450.00, 2, idCat3, 'https://placehold.co/600x400?text=Sofa']
        ];

        for (const p of products) {
            await pool.execute(
                "INSERT INTO producto (nombre, precio, stock, id_categoria, imagen) VALUES (?, ?, ?, ?, ?)",
                p
            );
        }

        // Estados de pedido
        const estados = ['Pendiente', 'Pagado', 'Enviado', 'Entregado', 'Cancelado'];
        for (const e of estados) {
            await pool.execute("INSERT INTO estado_pedido (nombre_estado) VALUES (?)", [e]);
        }

        console.log('Database seeded successfully! 🌱');
        process.exit(0);
    } catch (err) {
        console.error('Seed error (maybe data already exists):', err.message);
        process.exit(1);
    }
}

seed();
