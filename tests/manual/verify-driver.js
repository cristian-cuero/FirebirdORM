import { pool } from 'node-firebird';

const config = {
  host: 'localhost',
  port: 3050,
  database: 'test.fdb',
  user: 'SYSDBA',
  password: 'masterkey'
};

async function verify() {
  console.log('1. Iniciando pool...');
  const dbPool = pool(2, config); // Pool pequeño para probar agotamiento rápido

  console.log('2. Obteniendo conexión...');
  dbPool.get((err, db) => {
    if (err) throw err;
    console.log('   Conexión obtenida.');

    db.query('SELECT 1 FROM RDB$DATABASE', [], (err, res) => {
      if (err) throw err;
      console.log('   Query ejecutado.');

      // Prueba detach
      console.log('3. Ejecutando detach...');
      db.detach();
      console.log('   Detach ejecutado.');
      
      // Intentar usar db de nuevo después de detach
      db.query('SELECT 1 FROM RDB$DATABASE', [], (err, res) => {
        if (err) {
            console.log('   Correcto: Query falló tras detach:', err.message);
        } else {
            console.log('   ERROR: Query funcionó tras detach (Inesperado)');
        }
        
        // Cerrar pool
        dbPool.destroy();
        console.log('4. Pool destruido.');
      });
    });
  });
}

verify().catch(console.error);
