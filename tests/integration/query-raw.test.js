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
      });

      afterAll(async () => {
        await sequelize.close();
      });

      describe('SELECT básico con parametrización', () => {
        test('Debe ejecutar SELECT simple con replacements', async () => {
          const results = await sequelize.queryRaw(
            'SELECT ? as valor, ? as texto FROM RDB$DATABASE',
            { replacements: [123, 'hola'] }
          );

          expect(results).toHaveLength(1);
          expect(results[0].VALOR).toBe(123);
          expect(results[0].TEXTO).toBe('hola');
        });

        test('Debe manejar múltiples filas', async () => {
          // Creamos datos temporales
          await sequelize.queryRaw('CREATE TABLE temp_test (id INTEGER, name VARCHAR(50))');
          await sequelize.queryRaw('INSERT INTO temp_test VALUES (?, ?)', { replacements: [1, 'Pisco'] });
          await sequelize.queryRaw('INSERT INTO temp_test VALUES (?, ?)', { replacements: [2, 'Soporte'] });

          const results = await sequelize.queryRaw('SELECT * FROM temp_test ORDER BY id');

          expect(results).toHaveLength(2);
          expect(results[0].NAME).toBe('PISCO');
          expect(results[1].NAME).toBe('SOPORTE');

          await sequelize.queryRaw('DROP TABLE temp_test');
        });
      });

      describe('Seguridad: Prevención de SQL Injection', () => {
        test('Debe tratar replacements como valores literales, no SQL ejecutable', async () => {
          const maliciousInput = "1; DROP TABLE temp_test; --";

          // Esto NO debe ejecutar el DROP TABLE, debe buscar literalmente ese string
          const results = await sequelize.queryRaw(
            'SELECT ? as injected FROM RDB$DATABASE',
            { replacements: [maliciousInput] }
          );

          expect(results[0].INJECTED).toBe(maliciousInput);
        });
      });

      describe('SqlEscape.ident en queries reales', () => {
        test('Debe permitir nombres de tabla/columna case-sensitive', async () => {
          const tabla = 'MiTabla';
          const columna = 'MiColumna';

          await sequelize.queryRaw(`CREATE TABLE ${SqlEscape.ident(tabla)} (${SqlEscape.ident(columna)} VARCHAR(50))`);
          await sequelize.queryRaw(`INSERT INTO ${SqlEscape.ident(tabla)} (${SqlEscape.ident(columna)}) VALUES (?)`, { replacements: ['test'] });

          const results = await sequelize.queryRaw(`SELECT ${SqlEscape.ident(columna)} FROM ${SqlEscape.ident(tabla)}`);

          expect(results[0][columna.toUpperCase()]).toBe('TEST'); // Firebird uppercases unquoted, but we quoted it

          await sequelize.queryRaw(`DROP TABLE ${SqlEscape.ident(tabla)}`);
        });
      });

      describe('Transacciones con queryRaw', () => {
        test('Debe poder usar queryRaw dentro de una transacción', async () => {
          const tabla = 'tx_test';
          await sequelize.queryRaw(`CREATE TABLE ${SqlEscape.ident(tabla)} (id INTEGER, val VARCHAR(50))`);

          const t = await Transaction.start(sequelize);
          try {
            await sequelize.queryRaw(`INSERT INTO ${SqlEscape.ident(tabla)} (id, val) VALUES (?, ?)`, {
              replacements: [1, 'dentro_tx'],
              transaction: t
            });
            await sequelize.queryRaw(`INSERT INTO ${SqlEscape.ident(tabla)} (id, val) VALUES (?, ?)`, {
              replacements: [2, 'tambien_dentro'],
              transaction: t
            });
            await t.commit();

            const results = await sequelize.queryRaw(`SELECT val FROM ${SqlEscape.ident(tabla)} ORDER BY id`);
            expect(results).toHaveLength(2);
            expect(results[0].VAL).toBe('DENTRO_TX');
            expect(results[1].VAL).toBe('TAMBIEN_DENTRO');
          } catch (e) {
            await t.rollback();
            throw e;
          }

          await sequelize.queryRaw(`DROP TABLE ${SqlEscape.ident(tabla)}`);
        });

        test('Debe hacer rollback si la transacción falla', async () => {
          const tabla = 'tx_rollback';
          await sequelize.queryRaw(`CREATE TABLE ${SqlEscape.ident(tabla)} (id INTEGER PRIMARY KEY, val VARCHAR(50))`);
          await sequelize.queryRaw(`INSERT INTO ${SqlEscape.ident(tabla)} (id, val) VALUES (?, ?)`, { replacements: [1, 'existente'] });

          const t = await Transaction.start(sequelize);
          try {
            await sequelize.queryRaw(`INSERT INTO ${SqlEscape.ident(tabla)} (id, val) VALUES (?, ?)`, {
              replacements: [1, 'duplicado'], // Clave duplicada -> error
              transaction: t
            });
            await t.commit();
            throw new Error('Debería haber fallado por PK duplicada');
          } catch (e) {
            if (e.message.includes('Debería haber fallado')) throw e;
            await t.rollback();
          }

          // Verificar que el rollback funcionó: solo existe el registro original
          const results = await sequelize.queryRaw(`SELECT * FROM ${SqlEscape.ident(tabla)}`);
          expect(results).toHaveLength(1);
          expect(results[0].VAL).toBe('EXISTENTE');

          await sequelize.queryRaw(`DROP TABLE ${SqlEscape.ident(tabla)}`);
        });
      });

      describe('Procedimientos Almacenados (EXECUTE PROCEDURE)', () => {
        test('Debe ejecutar EXECUTE PROCEDURE simple', async () => {
          // Crear un procedimiento simple
          await sequelize.queryRaw(`
            SET TERM ^ ;
            CREATE PROCEDURE SP_TEST_SUM (A INTEGER, B INTEGER)
            RETURNS (SUM INTEGER) AS BEGIN SUM = A + B; SUSPEND; END ^
            SET TERM ; ^
          `);

          // Firebird: SELECT * FROM SP_TEST_SUM(?, ?) o EXECUTE PROCEDURE
          const results = await sequelize.queryRaw(
            'SELECT * FROM SP_TEST_SUM(?, ?)',
            { replacements: [10, 20] }
          );

          expect(results).toHaveLength(1);
          expect(results[0].SUM).toBe(30);

          await sequelize.queryRaw('DROP PROCEDURE SP_TEST_SUM');
        });

        test('Debe ejecutar EXECUTE PROCEDURE sin retorno (acción)', async () => {
          await sequelize.queryRaw(`
            SET TERM ^ ;
            CREATE PROCEDURE SP_INSERT_LOG (MSG VARCHAR(100)) AS
            BEGIN
              INSERT INTO TEMP_LOG (MSG) VALUES (:MSG);
            END ^
            SET TERM ; ^
          `);
          await sequelize.queryRaw('CREATE TABLE TEMP_LOG (MSG VARCHAR(100))');

          await sequelize.queryRaw(
            'EXECUTE PROCEDURE SP_INSERT_LOG(?)',
            { replacements: ['Mensaje de prueba'] }
          );

          const results = await sequelize.queryRaw('SELECT * FROM TEMP_LOG');
          expect(results).toHaveLength(1);
          expect(results[0].MSG).toBe('MENSAJE DE PRUEBA');

          await sequelize.queryRaw('DROP TABLE TEMP_LOG');
          await sequelize.queryRaw('DROP PROCEDURE SP_INSERT_LOG');
        });
      });
    });
  }
});