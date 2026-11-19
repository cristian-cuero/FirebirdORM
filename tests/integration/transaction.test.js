import { Sequelize } from '../../src/index.js';
import { DataTypes } from '../../src/core/data-types.js';
import { Transaction } from '../../src/transactions/transaction.js';

describe('Integration - Transaction Isolation', () => {
  let sequelize;
  let TestModel;

  beforeAll(async () => {
    sequelize = new Sequelize({
      host: 'localhost',
      port: 3050, // FB 3.0
      database: '/var/lib/firebird/data/employee.fdb',
      user: 'SYSDBA',
      password: 'masterkey',
    });
    await sequelize.init();
    try {
      await sequelize.query('DROP TABLE trans_test');
    } catch (e) {
      // Table might not exist, ignore
    }
    await sequelize.query('CREATE TABLE trans_test (id INTEGER PRIMARY KEY, name VARCHAR(50))');
    TestModel = sequelize.define('TestModel', {
      id: DataTypes.INTEGER,
      name: DataTypes.STRING(50)
    }, { tableName: 'trans_test' });
  });

  afterAll(async () => {
    try {
      await sequelize.query('DROP TABLE trans_test');
    } catch (e) {
      // Ignore
    }
    await sequelize.close();
  });

  test('INSERT/ROLLBACK should be isolated', async () => {
    const tx = new Transaction(sequelize.connectionManager);
    await tx.start();

    // Perform INSERT within transaction
    await TestModel.create({ id: 1, name: 'TxTest' }, { transaction: tx });

    // Check inside tx - should find it
    const inside = await TestModel.findAll({ where: { id: 1 }, transaction: tx });
    expect(inside.length).toBe(1);

    await tx.rollback();

    // Check outside tx - should NOT find it
    const outside = await TestModel.findAll({ where: { id: 1 } });
    expect(outside.length).toBe(0);
  });

  test('INSERT/COMMIT should persist', async () => {
    const tx = new Transaction(sequelize.connectionManager);
    await tx.start();

    await TestModel.create({ id: 2, name: 'CommitTest' }, { transaction: tx });

    const inside = await TestModel.findAll({ where: { id: 2 }, transaction: tx });
    expect(inside.length).toBe(1);

    await tx.commit();

    // Check outside tx - SHOULD find it
    const outside = await TestModel.findAll({ where: { id: 2 } });
    expect(outside.length).toBe(1);
  });

  test('SELECT inside transaction should see own changes', async () => {
    const tx = new Transaction(sequelize.connectionManager);
    await tx.start();

    // Insert
    await TestModel.create({ id: 3, name: 'SelectTest' }, { transaction: tx });

    // Update
    const instance = await TestModel.findOne({ where: { id: 3 }, transaction: tx });
    instance.name = 'Updated';
    await instance.save({ transaction: tx });

    // Check inside tx
    const inside = await TestModel.findAll({ where: { id: 3 }, transaction: tx });
    expect(inside.length).toBe(1);
    expect(inside[0].name).toBe('Updated');

    await tx.rollback();

    // Outside should NOT find it
    const outside = await TestModel.findAll({ where: { id: 3 } });
    expect(outside.length).toBe(0);
  });

  test('Multiple operations in transaction then rollback', async () => {
    const tx = new Transaction(sequelize.connectionManager);
    await tx.start();

    await TestModel.create({ id: 4, name: 'Multi1' }, { transaction: tx });
    await TestModel.create({ id: 5, name: 'Multi2' }, { transaction: tx });
    await TestModel.create({ id: 6, name: 'Multi3' }, { transaction: tx });

    const inside = await TestModel.findAll({ transaction: tx });
    expect(inside.length).toBe(3);

    await tx.rollback();

    const outside = await TestModel.findAll();
    expect(outside.length).toBe(0); // previous committed tests only
  });

  test('Rollback on error should work', async () => {
    const tx = new Transaction(sequelize.connectionManager);
    await tx.start();

    await TestModel.create({ id: 7, name: 'ErrorTest' }, { transaction: tx });

    // Try to insert duplicate - should fail
    try {
      await TestModel.create({ id: 7, name: 'ErrorTest2' }, { transaction: tx });
    } catch (e) {
      // Expected to fail
    }

    await tx.rollback();

    // Nothing should have persisted
    const outside = await TestModel.findAll({ where: { id: 7 } });
    expect(outside.length).toBe(0);
  });
});
