# Guía de Transacciones - firebird-orm

El ORM implementa transacciones ACID completas con aislamiento configurable y gestión de pool exclusivo.

## 1. Iniciar una transacción

```javascript
import { Transaction } from 'firebird-orm';

// Factory estático (recomendado): Crea e inicia en un paso
const tx = await Transaction.start(sequelize);
```

## 2. Usar la transacción
Pasa el objeto `transaction` en las opciones de cualquier operación del modelo o `queryRaw`:

```javascript
await User.create({ name: 'Test' }, { transaction: tx });
await User.update({ active: 0 }, { where: { id: 1 }, transaction: tx });
await sequelize.queryRaw('UPDATE ...', { transaction: tx });
```

## 3. Commit y Rollback

```javascript
try {
  await tx.commit(); // Confirma todos los cambios
} catch (err) {
  await tx.rollback(); // Revierte TODOS los cambios del bloque
  throw err;
}
```

## 4. Comportamiento Interno (Clave para Rendimiento)

*   **Reserva Exclusiva**: Al iniciar, el `ConnectionManager` reserva una conexión física del pool **solo para esta transacción**. No se comparte.
*   **Aislamiento**: Firebird 3.0+ usa `SNAPSHOT` (Repeatable Read). FB 2.5 usa `READ COMMITTED`.
*   **Limpieza Automática**: Al hacer `commit()` o `rollback()`, la conexión se libera de vuelta al pool automáticamente en el bloque `finally`.

## 5. Manejo de Errores y Deadlocks

```javascript
const tx = await Transaction.start(sequelize);
try {
  // ... operaciones
  await tx.commit();
} catch (error) {
  // Firebird puede lanzar deadlocks (SQLCODE -607 / GDSCODE 335544348)
  if (isDeadlock(error)) {
    // Lógica de reintento (retry logic)
  }
  await tx.rollback();
  throw error;
}
```

## 6. Transacciones Anidadas (Savepoints)
*Actualmente no soportado nativamente en la API pública, pero se puede lograr via `queryRaw('SAVEPOINT A')` / `ROLLBACK TO SAVEPOINT A`.*