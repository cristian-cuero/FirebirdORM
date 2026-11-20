import { Sequelize } from '../../src/index.js';
import { DataTypes } from '../../src/core/data-types.js';
import { Transaction } from '../../src/transactions/transaction.js';

describe('Integration - Transaction Isolation', () => {
  const TABLE_PREFIX = 'tx_';

  let sequelize;

  beforeAll(async () => {
    sequelize = new Sequelize({
      host: 'localhost',
      port: 3050, // FB 3.0
      database: '/var/lib/firebird/data/employee.fdb',
      user: 'SYSDBA',
      password: 'masterkey',
    });
    await sequelize.init();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // Helper to generate unique short IDs (avoid INTEGER overflow)
  const genId = () => Math.floor(Math.random() * 100000) + Date.now() % 100000;
  const genTableName = () => `${TABLE_PREFIX}${Math.random().toString(36).slice(2, 8)}`;

  test('INSERT/ROLLBACK should be isolated', async () => {
    const tableName = genTableName();
    await sequelize.query(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name VARCHAR(50))`);

    const TestModel = sequelize.define('TestModel', {
      id: DataTypes.INTEGER,
      name: DataTypes.STRING(50)
    }, { tableName });

    const tx = await Transaction.start(sequelize);
    const id = genId();

    await TestModel.create({ id, name: 'TxTest' }, { transaction: tx });

    const inside = await TestModel.findAll({ where: { id }, transaction: tx });
    expect(inside.length).toBe(1);

    await tx.rollback();

    const outside = await TestModel.findAll({ where: { id } });
    expect(outside.length).toBe(0);

    await sequelize.query(`DROP TABLE ${tableName}`);
  });

  test('INSERT/COMMIT should persist', async () => {
    const tableName = genTableName();
    await sequelize.query(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name VARCHAR(50))`);

    const TestModel = sequelize.define('TestModel', {
      id: DataTypes.INTEGER,
      name: DataTypes.STRING(50)
    }, { tableName });

    const tx = await Transaction.start(sequelize);
    const id = genId();

    await TestModel.create({ id, name: 'CommitTest' }, { transaction: tx });

    const inside = await TestModel.findAll({ where: { id }, transaction: tx });
    expect(inside.length).toBe(1);

    await tx.commit();

    const outside = await TestModel.findAll({ where: { id } });
    expect(outside.length).toBe(1);

    await sequelize.query(`DROP TABLE ${tableName}`);
  });

  test('SELECT inside transaction should see own changes', async () => {
    const tableName = genTableName();
    await sequelize.query(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name VARCHAR(50))`);

    const TestModel = sequelize.define('TestModel', {
      id: DataTypes.INTEGER,
      name: DataTypes.STRING(50)
    }, { tableName });

    const tx = await Transaction.start(sequelize);
    const id = genId();

    await TestModel.create({ id, name: 'SelectTest' }, { transaction: tx });

    const instance = await TestModel.findOne({ where: { id }, transaction: tx });
    instance.name = 'Updated';
    await instance.save({ transaction: tx });

    const inside = await TestModel.findAll({ where: { id }, transaction: tx });
    expect(inside.length).toBe(1);
    expect(inside[0].name).toBe('Updated');

    await tx.rollback();

    const outside = await TestModel.findAll({ where: { id } });
    expect(outside.length).toBe(0);

    await sequelize.query(`DROP TABLE ${tableName}`);
  });

  test('Multiple operations in transaction then rollback', async () => {
    const tableName = genTableName();
    await sequelize.query(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name VARCHAR(50))`);

    const TestModel = sequelize.define('TestModel', {
      id: DataTypes.INTEGER,
      name: DataTypes.STRING(50)
    }, { tableName });

    const tx = await Transaction.start(sequelize);
    const ids = [genId(), genId(), genId()];

    await TestModel.create({ id: ids[0], name: 'Multi1' }, { transaction: tx });
    await TestModel.create({ id: ids[1], name: 'Multi2' }, { transaction: tx });
    await TestModel.create({ id: ids[2], name: 'Multi3' }, { transaction: tx });

    const inside = await TestModel.findAll({ transaction: tx });
    expect(inside.length).toBe(3);

    await tx.rollback();

    const outside = await TestModel.findAll();
    const found = outside.filter(r => ids.includes(r.id));
    expect(found.length).toBe(0);

    await sequelize.query(`DROP TABLE ${tableName}`);
  });

  test('Rollback on error should work', async () => {
    const tableName = genTableName();
    await sequelize.query(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name VARCHAR(50))`);

    const TestModel = sequelize.define('TestModel', {
      id: DataTypes.INTEGER,
      name: DataTypes.STRING(50)
    }, { tableName });

    const tx = await Transaction.start(sequelize);
    const id = genId();

    await TestModel.create({ id, name: 'ErrorTest' }, { transaction: tx });

    try {
      await TestModel.create({ id, name: 'ErrorTest2' }, { transaction: tx });
    } catch (e) {
      // Expected to fail
    }

    await tx.rollback();

    const outside = await TestModel.findAll({ where: { id } });
    expect(outside.length).toBe(0);

    await sequelize.query(`DROP TABLE ${tableName}`);
  });
});