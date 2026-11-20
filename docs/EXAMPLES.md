# Ejemplos de uso de firebird-orm

## 1. Conexión y Definición de Modelos
```javascript
import { Sequelize, DataTypes } from 'firebird-orm';

const sequelize = new Sequelize({
  host: 'localhost',
  port: 3050,
  database: 'employee.fdb',
  user: 'SYSDBA',
  password: 'masterkey'
});

await sequelize.init();

// Definición de modelo
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  name: { type: DataTypes.STRING(50) }
}, { tableName: 'users' });
```

## 2. CRUD Completo
```javascript
// Crear
await User.create({ id: 1, name: 'Pisco' });

// Consultar
const user = await User.findOne({ where: { id: 1 } });

// Actualizar
await user.update({ name: 'Soporte' });

// Eliminar
await user.destroy();
```

## 3. Consultas Avanzadas (Query Builder)
```javascript
import { Op, fn, col } from 'firebird-orm';

const users = await User.findAll({
  where: {
    age: { [Op.gt]: 18 },
    name: { [Op.like]: 'P%' }
  },
  attributes: ['id', [fn('UPPER', col('name')), 'upperName']],
  order: [['id', 'DESC']],
  limit: 10
});
```

## 4. Transacciones
```javascript
import { Transaction } from 'firebird-orm';

const t = await Transaction.start(sequelize);
try {
  await User.create({ id: 2, name: 'Tx' }, { transaction: t });
  await t.commit();
} catch (e) {
  await t.rollback();
}
```

## 5. Consultas Nativas (queryRaw)
```javascript
// Útil para SPs legacy o DDL complejo
const results = await sequelize.queryRaw(
  'SELECT * FROM SP_GET_USER(?)', 
  { replacements: [1] }
);
```
