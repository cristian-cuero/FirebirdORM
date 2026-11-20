import { Sequelize, SqlEscape, Transaction } from '../../src/index.js';

describe('Integration - queryRaw (Consultas Nativas)', () => {
  const versions = [
    { name: 'Firebird 2.5', port: 3053, db: '/firebird/data/employee.fdb' },
    { name: 'Firebird 3.0', port: 3050, db: '/var/lib/firebird/data/employee.fdb' },
  ];

  for (const version of versions) {
    describe(`Backend: ${version.name}`, () => {
      let sequelize;

      beforeAll(async () => {
        sequelize = new Sequelize({
          host: 'localhost',
          port: version.port,
          database: version.db,
          user: 'SYSDBA',
          password: 'masterkey',
        });
        await sequelize.init();
      }, 30000);

      afterAll(async () => {
        await sequelize.close();
      });

      describe('SELECT básico con parametrización', () => {
        test('Debe ejecutar SELECT simple con replacements', async () => {
          const results = await sequelize.queryRaw(
            'SELECT CAST(? AS INTEGER) as valor, CAST(? AS VARCHAR(50)) as texto FROM RDB$DATABASE',
            { replacements: [123, 'hola'] }
          );

          expect(results).toHaveLength(1);
          expect(results[0].VALOR).toBe(123);
          expect(results[0].TEXTO).toBe('hola');
        });

        test('Debe manejar múltiples filas', async () => {
          const tableName = `tmp_${Math.random().toString(36).slice(2, 8)}`;
          await sequelize.queryRaw(`CREATE TABLE ${tableName} (id INTEGER, name VARCHAR(50))`);
          await sequelize.queryRaw(`INSERT INTO ${tableName} VALUES (?, ?)`, { replacements: [1, 'Pisco'] });
          await sequelize.queryRaw(`INSERT INTO ${tableName} VALUES (?, ?)`, { replacements: [2, 'Soporte'] });

          const results = await sequelize.queryRaw(`SELECT * FROM ${tableName} ORDER BY id`);

          expect(results).toHaveLength(2);
          expect(results[0].NAME).toBe('Pisco');
          expect(results[1].NAME).toBe('Soporte');

          await sequelize.queryRaw(`DROP TABLE ${tableName}`);
        }, 15000);
      });

      describe('Seguridad: Prevención de SQL Injection', () => {
        test('Debe tratar replacements como valores literales, no SQL ejecutable', async () => {
          const maliciousInput = "1; DROP TABLE temp_test; --";

          const results = await sequelize.queryRaw(
            'SELECT CAST(? AS VARCHAR(100)) as injected FROM RDB$DATABASE',
            { replacements: [maliciousInput] }
          );

          expect(results[0].INJECTED).toBe(maliciousInput);
        });
      });

      describe('SqlEscape.ident en queries reales', () => {
        test('Debe permitir nombres de tabla/columna case-sensitive', async () => {
          const suffix = Math.random().toString(36).slice(2, 8);
          const tabla = `MiTabla_${suffix}`;
          const columna = `MiColumna_${suffix}`;

          try { await sequelize.queryRaw(`DROP TABLE ${SqlEscape.ident(tabla)}`); } catch (e) {}
          await sequelize.queryRaw(`CREATE TABLE ${SqlEscape.ident(tabla)} (${SqlEscape.ident(columna)} VARCHAR(50))`);
          await sequelize.queryRaw(`INSERT INTO ${SqlEscape.ident(tabla)} (${SqlEscape.ident(columna)}) VALUES (?)`, { replacements: ['test'] });

          const results = await sequelize.queryRaw(`SELECT ${SqlEscape.ident(columna)} FROM ${SqlEscape.ident(tabla)}`);

          const keys = Object.keys(results[0]);
          const foundKey = keys.find(k => k === columna);

          expect(foundKey).toBe(columna);
          expect(results[0][foundKey]).toBe('test');

          await sequelize.queryRaw(`DROP TABLE ${SqlEscape.ident(tabla)}`);
        });
      });

      describe('Transacciones con queryRaw', () => {
        test('Debe poder usar queryRaw dentro de una transacción', async () => {
          const tableName = `tx_${Math.random().toString(36).slice(2, 8)}`;
          await sequelize.queryRaw(`CREATE TABLE ${tableName} (id INTEGER, val VARCHAR(50))`);

          const t = await Transaction.start(sequelize);
          try {
            await sequelize.queryRaw(`INSERT INTO ${tableName} (id, val) VALUES (?, ?)`, {
              replacements: [1, 'dentro_tx'],
              transaction: t
            });
            await sequelize.queryRaw(`INSERT INTO ${tableName} (id, val) VALUES (?, ?)`, {
              replacements: [2, 'tambien_dentro'],
              transaction: t
            });
            await t.commit();

            const results = await sequelize.queryRaw(`SELECT val FROM ${tableName} ORDER BY id`);
            expect(results).toHaveLength(2);
            const getVal = (row) => row.VAL || row.val;
            expect(getVal(results[0])).toBe('dentro_tx');
            expect(getVal(results[1])).toBe('tambien_dentro');
          } catch (e) {
            await t.rollback();
            throw e;
          }

          await sequelize.queryRaw(`DROP TABLE ${tableName}`);
        });

        test('Debe hacer rollback si la transacción falla', async () => {
          const tableName = `tx_rb_${Math.random().toString(36).slice(2, 8)}`;
          await sequelize.queryRaw(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, val VARCHAR(50))`);
          await sequelize.queryRaw(`INSERT INTO ${tableName} (id, val) VALUES (?, ?)`, { replacements: [1, 'existente'] });

          const t = await Transaction.start(sequelize);
          try {
            await sequelize.queryRaw(`INSERT INTO ${tableName} (id, val) VALUES (?, ?)`, {
              replacements: [1, 'duplicado'],
              transaction: t
            });
            await t.commit();
            throw new Error('Debería haber fallado por PK duplicada');
          } catch (e) {
            if (e.message.includes('Debería haber fallado')) throw e;
            await t.rollback();
          }

          const results = await sequelize.queryRaw(`SELECT * FROM ${tableName}`);
          expect(results).toHaveLength(1);
          const getVal = (row) => row.VAL || row.val;
          expect(getVal(results[0])).toBe('existente');

          await sequelize.queryRaw(`DROP TABLE ${tableName}`);
        });
      });

      describe('Procedimientos Almacenados (SKIP: Limitación wire protocol)', () => {
        test.skip('Debe ejecutar procedimiento almacenado simple (SELECT * FROM SP)', async () => {
          // SKIP: Crear SPs con punto y coma interno via wire protocol (node-firebird)
          // requiere manejo especial de bloques que no está implementado en el driver puro.
        });

        test.skip('Debe ejecutar procedimiento almacenado de acción (EXECUTE PROCEDURE)', async () => {
          // SKIP: Misma limitación.
        });
      });
    });
  }
});