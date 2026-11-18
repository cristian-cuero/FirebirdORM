# ARCHITECTURE - firebird-orm

## Visión General

Arquitectura modular en capas con **inversión de dependencias** para desacoplar el core del ORM de drivers específicos de base de datos.

```
┌─────────────────────────────────────────────────────────────────┐
│                        PUBLIC API                                │
│  Sequelize, Model, DataTypes, Op, Transaction, Migrator, ...    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CORE LAYER                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Sequelize  │  │   Model     │  │ QueryBuilder│              │
│  │   (Facade)  │◄─│  (Active    │◄─│  (Fluent    │              │
│  │             │  │   Record)   │  │   API)      │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────────────────────────────────────────┐             │
│  │              Dialect / QueryGenerator           │             │
│  │  (Firebird SQL generation, version-aware)       │             │
│  └────────────────────────┬────────────────────────┘             │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ADAPTER LAYER                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    IDriverAdapter (Interface)            │    │
│  │  connect() • createPool() • execute() • transaction()   │    │
│  │  commit() • rollback() • close() • ping()               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ▲                                      │
│              ┌────────────┴────────────┐                         │
│              ▼                         ▼                         │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │ NodeFirebirdAdapter │    │  NativeDriverAdapter │  (futuro)  │
│  │ (Implementación v1) │    │  (node-firebird-    │             │
│  │  usa node-firebird  │    │   driver-native)    │             │
│  └─────────────────────┘    └─────────────────────┘             │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DRIVER LAYER                                │
│  node-firebird (wire protocol, pure JS)                         │
│  fbclient.dll / libfbclient.so (solo si adapter nativo)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Capas Detalladas

### 1. Public API (`src/index.js`)

Punto de entrada único. Exporta todo lo público:

- `Sequelize` - Conexión principal
- `Model`, `DataTypes` - Definición de modelos
- `Op`, `fn`, `col`, `literal` - Query building
- `Transaction` - Control transaccional
- `Migrator`, `Migration` - Migraciones
- Associations: `HasMany`, `BelongsTo`, `HasOne`, `BelongsToMany`
- Errors: `ValidationError`, `DatabaseError`, `ConnectionError`

**Tipado:** JSDoc en código + `.d.ts` generados en build posterior (fase TypeScript)

### 2. Core Layer (`src/core/`)

| Módulo                  | Responsabilidad                                                       |
| ----------------------- | --------------------------------------------------------------------- |
| `sequelize.js`          | Facade principal, gestor de modelos, pool, transacciones              |
| `model.js`              | Clase base `Model` (Active Record), CRUD, hooks, validaciones         |
| `data-types.js`         | Registry de tipos, mapeo FB ↔ JS, serialización                       |
| `dialect.js`            | Generación SQL específica Firebird, versión-aware                     |
| `version-detector.js`   | Detecta versión FB al conectar, expone `capabilities`                 |
| `connection-manager.js` | **NO toca driver directo** - usa `IDriverAdapter`                     |
| `driver-adapter.js`     | **INTERFAZ** `IDriverAdapter` - contrato para adapters                |
| `associations/`         | Relaciones: HasMany, BelongsTo, HasOne, BelongsToMany                 |
| `hooks.js`              | Sistema de eventos (before/after Create, Update, Destroy, Find, Bulk) |
| `validations.js`        | Validadores built-in + custom sync/async                              |
| `errors.js`             | Jerarquía de errores tipados                                          |

**Nota:** Sin decoradores. La definición de modelos usa `sequelize.define()` con objeto de configuración. JSDoc en cada clase/método para futura generación de `.d.ts`.

### 3. Query Layer (`src/query/`)

| Módulo               | Responsabilidad                                                                       |
| -------------------- | ------------------------------------------------------------------------------------- |
| `query-generator.ts` | Convierte AST → SQL Firebird (SELECT, INSERT, UPDATE, DELETE, DDL)                    |
| `query-builder.ts`   | API fluida: `.where().order().limit().include()`                                      |
| `operators.ts`       | `Op`: eq, ne, gt, gte, lt, lte, like, iLike, in, notIn, between, isNull, and, or, not |
| `functions.ts`       | `fn()`, `col()`, `literal()`, `cast()` para funciones SQL                             |

### 4. Adapter Layer (`src/core/driver-adapter.js` + `src/adapters/`)

#### Interfaz Contrato (`IDriverAdapter`)

```javascript
/**
 * @interface IDriverAdapter
 * @description Contrato que debe implementar cualquier adapter de driver
 */
class IDriverAdapter {
  /**
   * Conexión simple
   * @param {ConnectionConfig} config
   * @returns {Promise<IDriverConnection>}
   */
  async connect(config) {}

  /**
   * Pool de conexiones
   * @param {PoolConfig} config
   * @returns {Promise<IDriverPool>}
   */
  async createPool(config) {}

  /**
   * Ejecución parametrizada (OBLIGATORIA para seguridad)
   * @param {IDriverConnection} connection
   * @param {string} sql
   * @param {unknown[]} params
   * @returns {Promise<QueryResult>}
   */
  async execute(connection, sql, params) {}

  /**
   * Transacciones
   * @param {IDriverConnection} connection
   * @returns {Promise<IDriverTransaction>}
   */
  async startTransaction(connection) {}

  async commit(transaction) {}
  async rollback(transaction) {}

  /**
   * Utilidades
   */
  async close(connectionOrPool) {}
  async ping(connection) {}

  /**
   * Metadatos
   */
  getDriverName() {}
  getDriverVersion() {}
}

/**
 * @typedef {Object} IDriverConnection
 * @property {(sql: string, params: unknown[]) => Promise<QueryResult>} execute
 * @property {() => Promise<IDriverTransaction>} startTransaction
 * @property {() => Promise<void>} close
 */

/**
 * @typedef {Object} IDriverPool
 * @property {() => Promise<IDriverConnection>} acquire
 * @property {(connection: IDriverConnection) => Promise<void>} release
 * @property {() => Promise<void>} drain
 * @property {() => Promise<void>} close
 */

/**
 * @typedef {Object} IDriverTransaction
 * @property {() => Promise<void>} commit
 * @property {() => Promise<void>} rollback
 */

/**
 * @typedef {Object} QueryResult
 * @property {Record<string, unknown>[]} rows
 * @property {number} rowsAffected
 * @property {string|number} [insertId]
 */

/**
 * @typedef {Object} ConnectionConfig
 * @property {string} host
 * @property {number} port
 * @property {string} database
 * @property {string} user
 * @property {string} password
 * @property {string} [role]
 * @property {string} [charset]
 */

/**
 * @typedef {Object} PoolConfig
 * @property {number} min
 * @property {number} max
 * @property {number} [idleTimeout]
 * @property {number} [acquireTimeout]
 * @property {string} host
 * @property {number} port
 * @property {string} database
 * @property {string} user
 * @property {string} password
 */
```

#### Implementación v1: `NodeFirebirdAdapter` (`src/adapters/node-firebird/index.js`)

```javascript
import Firebird from 'node-firebird';
import { IDriverAdapter } from '../../core/driver-adapter.js';

export class NodeFirebirdAdapter extends IDriverAdapter {
  // Implementa la interfaz usando node-firebird
  // - pool: Firebird.pool()
  // - execute: connection.query(sql, params, callback) → Promise
  // - transacciones: connection.transaction()
  // - mapea errores node-firebird → errores estandarizados
}
```

**Registro de adapter:**

```javascript
// En Sequelize constructor
const sequelize = new Sequelize({
  dialect: 'firebird',
  driver: 'node-firebird', // o instancia custom de IDriverAdapter
  // ...
});
```

### 5. Transactions Layer (`src/transactions/`)

| Módulo           | Responsabilidad                                                     |
| ---------------- | ------------------------------------------------------------------- |
| `transaction.ts` | Clase `Transaction` - wrapper unificado, savepoints, aislamiento    |
| `cls.ts`         | (Opcional) Continuation Local Storage para transacciones implícitas |

### 6. Migrations Layer (`src/migrations/`)

| Módulo         | Responsabilidad                                          |
| -------------- | -------------------------------------------------------- |
| `migrator.ts`  | Ejecutor: up(), down(), status(), create()               |
| `migration.ts` | Clase base `Migration` con métodos DDL helpers           |
| `cli.ts`       | Comandos CLI: `migration:create`, `up`, `down`, `status` |
| `storage.ts`   | Tabla `sequelize_meta` (name, executed_at, checksum)     |

### 7. Utils (`src/utils/`)

| Módulo          | Responsabilidad                                                      |
| --------------- | -------------------------------------------------------------------- |
| `sql-escape.ts` | `escape()`, `escapeIdentifier()` - **único lugar para sanitización** |
| `logger.ts`     | Logging configurable (sql, timing, warnings)                         |
| `helpers.ts`    | Utilidades varias (cloneDeep, isPlainObject, etc.)                   |

---

## Flujo de Datos Típico

### `User.findAll({ where: { username: 'juan' } })`

```
1. User.findAll() → Model.findAll()
2. Model.findAll() → QueryBuilder.buildSelect()
3. QueryBuilder → QueryGenerator.generateSelect()
   - where: { username: 'juan' } → "WHERE username = ?"
   - params: ['juan']
4. QueryGenerator → Dialect.applyLimitOffset() (version-aware)
5. Sequelize.query(sql, params) → ConnectionManager.getConnection()
6. ConnectionManager → Adapter.execute(connection, sql, params)
7. NodeFirebirdAdapter → node-firebird connection.query(sql, params)
8. Result → QueryResult → Model.buildInstances(rows)
9. Return Model[] instances
```

### `await sequelize.transaction(async (t) => { ... })`

```
1. sequelize.transaction(callback)
2. ConnectionManager.getConnection() → Adapter.createPool().acquire()
3. Adapter.startTransaction(connection) → IDriverTransaction
4. Transaction wrapper creado con (connection, driverTransaction)
5. Ejecuta callback(t) → todas las queries pasan { transaction: t }
6. En query: Adapter.execute(t.connection, sql, params) dentro de tx
7. Commit/Rollback → Adapter.commit/rollback(driverTransaction)
8. Release connection → pool.release()
```

---

## Decoupling Benefits

| Cambio Futuro            | Impacto en Core | Acción Requerida                                        |
| ------------------------ | --------------- | ------------------------------------------------------- |
| Nuevo driver nativo      | **Cero**        | Crear `NewDriverAdapter` implementando `IDriverAdapter` |
| Cambiar pooling strategy | **Cero**        | Modificar solo adapter                                  |
| Añadir tracing/metrics   | **Mínimo**      | Wrapper en adapter o middleware en ConnectionManager    |
| Testing sin BD real      | **Nativo**      | `MockAdapter` implementando `IDriverAdapter`            |

---

## Estructura de Carpetas Final

```
src/
├── index.js                      # Public API exports
├── core/
│   ├── sequelize.js
│   ├── model.js
│   ├── data-types.js
│   ├── dialect.js
│   ├── version-detector.js
│   ├── connection-manager.js     # USA IDriverAdapter
│   ├── driver-adapter.js         # INTERFACE IDriverAdapter
│   ├── associations/
│   │   ├── index.js
│   │   ├── has-many.js
│   │   ├── belongs-to.js
│   │   ├── has-one.js
│   │   └── belongs-to-many.js
│   ├── hooks.js
│   ├── validations.js
│   └── errors.js
├── query/
│   ├── query-generator.js
│   ├── query-builder.js
│   ├── operators.js
│   └── functions.js
├── transactions/
│   ├── transaction.js
│   └── cls.js
├── migrations/
│   ├── migrator.js
│   ├── migration.js
│   ├── cli.js
│   └── storage.js
├── adapters/
│   └── node-firebird/
│       ├── index.js              # NodeFirebirdAdapter
│       ├── connection.js
│       ├── pool.js
│       └── transaction.js
├── utils/
│   ├── sql-escape.js
│   ├── logger.js
│   └── helpers.js
└── types/
    └── index.js                  # JSDoc typedefs (público)
```

---

## Version Detection & Capabilities

Al conectar, `VersionDetector` ejecuta:

```sql
SELECT RDB$GET_CONTEXT('SYSTEM', 'ENGINE_VERSION') FROM RDB$DATABASE
```

Y expone `capabilities`:

```typescript
interface DialectCapabilities {
  hasIdentityColumns: boolean; // FB 4.0+
  hasBooleanType: boolean; // FB 3.0+
  hasReturningClause: boolean; // FB 3.0+
  hasLimitOffset: boolean; // FB 4.0+
  hasMerge: boolean; // FB 2.1+
  hasWindowFunctions: boolean; // FB 4.0+
  supportsSavepoints: boolean; // FB 1.5+
  maxIdentifierLength: number; // 63 (FB 3.0+), 31 (FB 2.5)
}
```

El `QueryGenerator` consulta `capabilities` para generar SQL óptimo.

---

## Seguridad: Parametrización Garantizada

**Regla de arquitectura:** `ConnectionManager.execute()` y `Adapter.execute()` **SOLO aceptan** `(sql: string, params: unknown[])`.

- ❌ **Prohibido** en todo el codebase: concatenación de strings en SQL
- ✅ **Único lugar** para escapar identificadores: `utils/sql-escape.ts` → `escapeIdentifier()`
- ✅ **Validación** en `Model.define()`: nombres de tabla/columna validados contra regex seguro

---

## Testing Strategy por Capa

| Capa                                | Test Type   | Mock                                      |
| ----------------------------------- | ----------- | ----------------------------------------- |
| Core (Model, QueryBuilder, Dialect) | Unit (Jest) | `MockAdapter` implementa `IDriverAdapter` |
| Adapters                            | Integration | Real `node-firebird` + Docker FB          |
| Migrations                          | Integration | Real FB + temp schema                     |
| E2E                                 | Integration | Docker Compose FB 3.0/4.0/5.0 matrix      |

---

_Última actualización: 2026-11-13 - Arquitectura con Adapter Pattern confirmada_
