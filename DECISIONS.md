# DECISIONS - firebird-orm

Registro de decisiones técnicas importantes que afectan la arquitectura.

---

## 1. Driver de Base de Datos

**Fecha:** 2026-11-13  
**Decisión:** Usar `node-firebird` (hgourvest) como driver principal  
**Alternativas evaluadas:**

- `node-firebird-driver` - Solo interfaces TypeScript, no implementación completa
- `node-firebird-driver-native` - Binding nativo, requiere compilación C++, fbclient.dll

**Justificación:**

- Zero native dependencies → instalación trivial en cualquier OS/CI
- Pool de conexiones nativo, Promises/async-await, transacciones
- Compatible Firebird 2.5, 3.0, 4.0, 5.0 via wire protocol
- Mantenimiento activo (~100k descargas/semana)
- **Validado en producción** por el usuario

**Arquitectura: Patrón Adapter para Drivers**  
El core del ORM **NO depende directamente de `node-firebird`**. Se define una interfaz `IDriverAdapter` en `src/core/driver-adapter.ts` que abstrae:

- `connect(config)` → `Connection`
- `createPool(config)` → `Pool`
- `execute(connection, sql, params)` → `Result`
- `startTransaction(connection)` → `Transaction`
- `commit/rollback(transaction)`
- `close(connection/pool)`

Implementación inicial: `NodeFirebirdAdapter` en `src/adapters/node-firebird/`.
Futuro: `NativeDriverAdapter` para `node-firebird-driver-native` sin tocar el core.

---

## 2. Versiones Soportadas (v1.0.0)

**Fecha:** 2026-11-13  
**Decisión:**

- Node.js: **≥ 18 LTS** (Hydrogen, Iron, Jod)
- Firebird: **3.0+** (4.0, 5.0 full support); 2.5 best-effort

**Rationale:**

- Node 18+: ESM nativo, fetch, crypto, larga vida LTS
- Firebird 3.0+: BOOLEAN, RETURNING, sintaxis moderna
- FB 2.5: Solo si no requiere features modernas (generators+triggers para PK)

**Estrategia de compatibilidad:** Detección automática de versión al conectar → adapta dialecto SQL

---

## 3. API Pública - Estilo de Definición de Modelos

**Fecha:** 2026-11-13  
**Decisión:** **JavaScript nativo first** (ESM + CommonJS dual) — TypeScript se añade en fase posterior

**API JavaScript (única por ahora):**

```javascript
// Factory function (estilo Sequelize clásico)
const User = sequelize.define(
  'User',
  {
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    birthday: { type: DataTypes.DATE, field: 'birth_date' },
  },
  { tableName: 'users', timestamps: true }
);

// Uso
const users = await User.findAll({ where: { username: 'juan' } });
const newUser = await User.create({ username: 'ana' });
```

**Por qué:**

- Usuario prefiere JS nativo para arrancar
- JSDoc + `.d.ts` generados luego para soporte TS opcional
- Menos tooling inicial, iteración más rápida
- API idéntica a la que tendría con clases TS, solo sin decoradores

---

## 4. Estrategia de Claves Primarias (Auto-incremento)

**Fecha:** 2026-11-13  
**Decisión:** **Detección automática por versión de Firebird**

- FB 4.0+: `IDENTITY` column (nativo, estándar SQL)
- FB 2.5/3.0: `GENERATOR` + `BEFORE INSERT TRIGGER` (tradicional)

**API unificada:**

```typescript
@PrimaryKey @AutoIncrement @Column(DataTypes.INTEGER) declare id: number;
// O con generador custom:
@Column({ type: DataTypes.INTEGER, autoIncrement: true, generatorName: 'GEN_MY_ID' })
```

**Ventaja:** Desarrollador no preocupa por versión FB; ORM genera DDL correcto en `sync()` y migraciones.

---

## 5. RETURNING Clause

**Fecha:** 2026-11-13  
**Decisión:** Soporte nativo en FB 3.0+ para INSERT/UPDATE/DELETE

```typescript
// create con retorno de campos generados
const user = await User.create({ username: 'juan' }, { returning: ['id', 'created_at'] });

// bulkCreate
const users = await User.bulkCreate(data, { returning: true });
```

**FB 2.5:** Fallback a SELECT posterior (menos eficiente, documentado).

---

## 6. Transacciones

**Fecha:** 2026-11-13  
**Decisión:** Dos APIs complementarias

**Managed (recomendada):**

```typescript
await sequelize.transaction(async t => {
  const user = await User.create({ username: 'ana' }, { transaction: t });
  await Post.create({ title: 'Hola', userId: user.id }, { transaction: t });
});
```

**Manual:**

```typescript
const t = await sequelize.startTransaction();
try { await ...; await t.commit(); } catch { await t.rollback(); throw e; }
```

**Niveles aislamiento FB:** `READ_COMMITTED` (default), `SNAPSHOT`, `SNAPSHOT_TABLE_STABILITY`

---

## 7. Paginación

**Fecha:** 2026-11-13  
**Decisión:** API unificada `limit`/`offset` → SQL adaptado por versión

| Firebird  | SQL Generado                    |
| --------- | ------------------------------- |
| 2.5 / 3.0 | `SELECT ... ROWS 20 TO 40`      |
| 4.0+      | `SELECT ... LIMIT 20 OFFSET 40` |

**Cursor-based** para datasets grandes: `where: { id: { [Op.gt]: lastId } }, limit: 20, order: [['id', 'ASC']]`

---

## 8. Mapeo de Tipos de Datos (Firebird ↔ DataTypes ↔ JS)

| Firebird     | DataTypes    | JS Type           | Notas                          |
| ------------ | ------------ | ----------------- | ------------------------------ |
| INTEGER      | INTEGER      | number            | 32-bit                         |
| BIGINT       | BIGINT       | bigint \| number  | 64-bit                         |
| NUMERIC(p,s) | DECIMAL(p,s) | **string**        | Precisión exacta → string      |
| VARCHAR(n)   | STRING(n)    | string            |                                |
| BLOB TEXT    | TEXT         | string            |                                |
| BLOB BINARY  | BLOB         | Buffer            |                                |
| DATE         | DATEONLY     | Date (solo fecha) |                                |
| TIMESTAMP    | DATE         | Date              |                                |
| BOOLEAN      | BOOLEAN      | boolean           | FB 3.0+ (FB 2.5: SMALLINT 0/1) |
| UUID         | UUID         | string            | FB 4.0+ nativo                 |

**Decisión clave:** `DECIMAL/NUMERIC` → **string** en JS para evitar pérdida de precisión.

---

## 9. Estructura Modular del Proyecto

**Fecha:** 2026-11-13  
**Decisión:** Arquitectura por capas en `src/`

```
src/
├── core/           # Sequelize, ConnectionManager, Dialect, VersionDetector
├── models/         # Model, DataTypes, Decorators, Hooks, Validations, Associations
├── query/          # QueryBuilder, QueryGenerator, Operators, Functions
├── transactions/   # Transaction, CLS (opcional)
├── migrations/     # Migrator, Migration, CLI, Storage
├── utils/          # Logger, Helpers, SqlEscape
└── types/          # Tipos TypeScript públicos
```

**Principio:** Separación de responsabilidades, cada módulo testeable independientemente.

---

## 10. Protección contra SQL Injection

**Fecha:** 2026-11-13  
**Decisión:** **Parametrización obligatoria** en todas las APIs

```typescript
// QueryBuilder - SIEMPRE parámetros
User.findAll({ where: { username: input } }); // WHERE username = ?

// Raw queries - SOLO con bind/replacements
sequelize.query('SELECT * FROM users WHERE username = $1', { bind: [input] });

// Identificadores dinámicos - escapeIdentifier
sequelize.query(`SELECT * FROM ${sequelize.escapeIdentifier(table)} WHERE id = ?`, {
  replacements: [id],
});
```

**Reglas:**

- ❌ Nunca concatenar en where/order/group
- ✅ Op.like, Op.in, etc. usan parámetros internamente
- ✅ Validación de esquema en define() previene inyección en DDL

---

## 11. Testing Strategy

**Fecha:** 2026-11-13  
**Decisión:** Dual layer

| Tipo        | Tool          | Target                                                           |
| ----------- | ------------- | ---------------------------------------------------------------- |
| Unit        | Jest          | QueryGenerator, DataTypes, Model logic, Associations (mocked)    |
| Integration | Jest + Docker | CRUD real, Transactions, Hooks, Migrations contra FB 3.0/4.0/5.0 |

**Matrix CI:** Firebird 3.0, 4.0, 5.0 (contenedores Docker)
**Cobertura objetivo:** > 85%

---

## 12. Build y Publicación NPM

**Fecha:** 2026-11-13  
**Decisión:** Dual package (ESM + CJS) + TypeScript declarations

```
dist/
├── esm/          # ESM modules (package.json "type": "module")
├── cjs/          # CommonJS (transpilado)
└── types/        # .d.ts files
```

**package.json exports:**

```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    }
  }
}
```

**Engines:** `"node": ">=18.0.0"`

---

## 13. CLI de Migraciones

**Fecha:** 2026-11-13  
**Decisión:** Binario `firebird-orm` incluido en paquete

```bash
npx firebird-orm migration:create create-users-table
npx firebird-orm migration:up
npx firebird-orm migration:down
npx firebird-orm migration:status
```

**Storage:** Tabla `sequelize_meta` (name, executed_at, checksum)

---

## 14. Hooks y Validaciones

**Fecha:** 2026-11-13  
**Decisión:** Hooks en instancia y clase, validaciones sync/async

**Hooks ciclo de vida:**

- Instance: beforeValidate, afterValidate, beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDestroy, afterDestroy
- Bulk: beforeBulkCreate, afterBulkCreate, beforeBulkUpdate, afterBulkUpdate, beforeBulkDestroy, afterBulkDestroy
- Query: beforeFind, afterFind

**Validaciones:** Built-in (isEmail, len, isIn, notNull, isNumeric, custom) + async custom validators

---

## 15. Logging y Debug

**Fecha:** 2026-11-13  
**Decisión:** Configurable en constructor

```typescript
new Sequelize({
  logging: console.log, // default
  logging: false, // desactivar
  logging: (sql, time) => customLogger(sql, time), // custom
});
```

---

_Última actualización: 2026-11-13 - Análisis técnico completo aprobado para Fase 0_

## 4. Gestión de Transacciones

**Fecha:** 2026-11-18  
**Decisión:** 
- Reserva de conexión física exclusiva por transacción hasta COMMIT/ROLLBACK.
- Uso de estados internos en objeto Transaction para prevenir operaciones inválidas.
- Propagación explícita mediante parámetro  en API CRUD.
- Cada instancia de Sequelize administra su propio pool de conexiones.

## 4. Gesti�n de Transacciones

**Fecha:** 2026-11-18  
**Decisi�n:** 
- Reserva de conexi�n f�sica exclusiva por transacci�n hasta COMMIT/ROLLBACK.
- Uso de estados internos en objeto Transaction para prevenir operaciones inv�lidas.
- Propagaci�n expl�cita mediante par�metro { transaction: t } en API CRUD.
- Cada instancia de Sequelize administra su propio pool de conexiones.
