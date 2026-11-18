import { Sequelize } from '../../src/index.js';

describe('Integration - Connection', () => {
  const versions = [
    { name: 'Firebird 2.5', port: 3053, database: '/firebird/data/employee.fdb' },
    { name: 'Firebird 3.0', port: 3050, database: '/var/lib/firebird/data/employee.fdb' },
    { name: 'Firebird 4.0', port: 3054, database: '/var/lib/firebird/data/employee.fdb' },
    { name: 'Firebird 5.0', port: 3052, database: '/var/lib/firebird/data/employee.fdb' },
  ];

  for (const version of versions) {
    test(`Conexión exitosa a ${version.name}`, async () => {
      const sequelize = new Sequelize({
        host: 'localhost',
        port: version.port,
        database: version.database,
        user: 'SYSDBA',
        password: 'masterkey',
        pool: { max: 2 },
      });

      try {
        await sequelize.init();
        expect(sequelize.version).toBeDefined();
        expect(typeof sequelize.version).toBe('string');

        const result = await sequelize.query('SELECT 1 as val FROM rdb$database');
        expect(result).toBeDefined();
        expect(result[0].VAL).toBe(1);
      } catch (error) {
        console.error(`Error connecting to ${version.name}:`, error);
        throw error;
      } finally {
        await sequelize.close();
      }
    });
  }
});
