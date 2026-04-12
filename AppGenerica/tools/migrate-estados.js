/**
 * MIGRATION: Actualizar estados_pedido al sistema de 6 estados
 *
 * Sistema correcto:
 *   1 = Pendiente
 *   2 = Confirmado  (antes: Pagado)
 *   3 = Preparando  (antes: Enviado)
 *   4 = En camino   (NUEVO)
 *   5 = Entregado   (antes: estaba en ID 4)
 *   6 = Cancelado   (antes: estaba en ID 5)
 *
 * Este script es IDEMPOTENTE: detecta el estado actual del DB y aplica
 * solo los cambios necesarios sin duplicar datos.
 *
 * Uso: node tools/migrate-estados.js
 */

const db = require('../db');

async function migrateEstados() {
  console.log('🔄 Iniciando migración de estados de pedido...\n');

  try {
    const [rows] = await db.execute('SELECT id_estado, nombre_estado FROM estado_pedido ORDER BY id_estado');
    console.log('📋 Estados actuales en DB:');
    rows.forEach(r => console.log(`   ${r.id_estado} = ${r.nombre_estado}`));
    console.log('');

    const estadosTarget = [
      { id: 1, nombre: 'Pendiente' },
      { id: 2, nombre: 'Confirmado' },
      { id: 3, nombre: 'Preparando' },
      { id: 4, nombre: 'En camino' },
      { id: 5, nombre: 'Entregado' },
      { id: 6, nombre: 'Cancelado' },
    ];

    const existingIds = new Set(rows.map(r => r.id_estado));
    const existingNames = new Map(rows.map(r => [r.id_estado, r.nombre_estado]));

    for (const target of estadosTarget) {
      if (!existingIds.has(target.id)) {
        await db.execute(
          'INSERT INTO estado_pedido (id_estado, nombre_estado) VALUES (?, ?)',
          [target.id, target.nombre]
        );
        console.log(`✅ Insertado: ID ${target.id} = "${target.nombre}"`);
      } else if (existingNames.get(target.id) !== target.nombre) {
        const old = existingNames.get(target.id);
        await db.execute(
          'UPDATE estado_pedido SET nombre_estado = ? WHERE id_estado = ?',
          [target.nombre, target.id]
        );
        console.log(`🔄 Actualizado: ID ${target.id}: "${old}" → "${target.nombre}"`);
      } else {
        console.log(`✔️  Sin cambios: ID ${target.id} = "${target.nombre}"`);
      }
    }

    const [after] = await db.execute('SELECT id_estado, nombre_estado FROM estado_pedido ORDER BY id_estado');
    console.log('\n📋 Estados finales en DB:');
    after.forEach(r => console.log(`   ${r.id_estado} = ${r.nombre_estado}`));
    console.log('\n🎉 Migración completada correctamente.');
  } catch (err) {
    console.error('❌ Error durante la migración:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrateEstados();
