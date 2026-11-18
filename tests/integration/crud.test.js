import { Sequelize } from '../../src/index.js';
import { DataTypes } from '../../src/core/data-types.js';
import { DatabaseError } from '../../src/core/errors.js';
import { Op } from '../../src/query/operators.js';

describe('Integration - CRUD Operations (FB 2.5 & 3.0)', () => {
  const versions = [
    { name: 'Firebird 2.5', port: 3053, db: '/firebird/data/employee.fdb' },
    { name: 'Firebird 3.0', port: 3050, db: '/var/lib/firebird/data/employee.fdb' },
  ];

  for (const version of versions) {
    describe(`Backend: ${version.name}`, () => {
      let sequelize;
      let TestModel;

      beforeAll(async () => {
        sequelize = new Sequelize({
          host: 'localhost',
          port: version.port,
          database: version.db,
          user: 'SYSDBA',
          password: 'masterkey',
        });
        await sequelize.init();

        // Creamos tabla simple para pruebas
        await sequelize.query('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name VARCHAR(50), age INTEGER, active SMALLINT)');

        TestModel = sequelize.define('TestModel', {
          id: DataTypes.INTEGER,
          name: DataTypes.STRING(50),
          age: DataTypes.INTEGER,
          active: DataTypes.INTEGER
        }, { tableName: 'test_table' });
      });

      afterAll(async () => {
        await sequelize.query('DROP TABLE test_table');
        await sequelize.close();
      });

      test('Debe crear un registro y consultarlo', async () => {
        const data = { id: 10, name: 'MigracionVB6', age: 30, active: 1 };

        await TestModel.create(data);
        const results = await TestModel.findAll({ where: { id: 10 } });

        expect(results.length).toBe(1);
        expect(results[0].NAME).toBe('MigracionVB6');
      });

      test('Debe actualizar un registro', async () => {
        await TestModel.create({ id: 20, name: 'Original', age: 25, active: 1 });

        await TestModel.update({ name: 'Actualizado', age: 26 }, { where: { id: 20 } });

        const results = await TestModel.findAll({ where: { id: 20 } });
        expect(results[0].NAME).toBe('Actualizado');
        expect(results[0].AGE).toBe(26);
      });

      test('Debe eliminar un registro', async () => {
        await TestModel.create({ id: 30, name: 'Borrar', age: 40, active: 1 });

        await TestModel.destroy({ where: { id: 30 } });

        const results = await TestModel.findAll({ where: { id: 30 } });
        expect(results.length).toBe(0);
      });

      test('Debe soportar operadores LIKE', async () => {
        await TestModel.create({ id: 40, name: 'Juan Perez', age: 35, active: 1 });
        await TestModel.create({ id: 41, name: 'Maria Lopez', age: 28, active: 1 });

        const results = await TestModel.findAll({
          where: { name: { [Op.like]: 'Juan%' } }
        });

        expect(results.length).toBe(1);
        expect(results[0].NAME).toBe('Juan Perez');
      });

      test('Debe soportar operadores IN', async () => {
        await TestModel.create({ id: 50, name: 'Test1', age: 20, active: 1 });
        await TestModel.create({ id: 51, name: 'Test2', age: 22, active: 0 });

        const results = await TestModel.findAll({
          where: { id: { [Op.in]: [50, 51] } }
        });

        expect(results.length).toBe(2);
      });

      test('Debe soportar operadores AND/OR anidados', async () => {
        // (name LIKE 'Test%' AND active = 1) OR age > 30
        const results = await TestModel.findAll({
          where: {
            [Op.or]: [
              {
                [Op.and]: [
                  { name: { [Op.like]: 'Test%' } },
                  { active: 1 }
                ]
              },
              { age: { [Op.gt]: 30 } }
            ]
          }
        });

        // Debe encontrar: Test1 (active=1), Juan Perez (age=35)
        expect(results.length).toBeGreaterThanOrEqual(2);
      });

      test('Debe lanzar DatabaseError ante duplicados', async () => {
        const data = { id: 11, name: 'Original', age: 25, active: 1 };
        await TestModel.create(data);

        await expect(TestModel.create(data)).rejects.toThrow(DatabaseError);
      });
    });
  }
});