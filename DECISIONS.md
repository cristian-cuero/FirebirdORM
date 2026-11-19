# DECISIONS - firebird-orm

Registro de decisiones tÃ©cnicas importantes que afectan la arquitectura.

---

## 1. Driver de Base de Datos

**Fecha:** 2026-11-13  
**DecisiÃ³n:** Usar `node-firebird` (hgourvest) como driver principal  
**Alternativas evaluadas:**

- `node-firebird-driver` - Solo interfaces TypeScript, no implementaciÃ³n completa
- `node-firebird-driver-native` - Binding nativo, requiere compilaciÃ³n C++, fbclient.dll

**JustificaciÃ³n:**

- Zero native dependencies â†’ instalaciÃ³n trivial en cualquier OS/CI
- Pool de conexiones nativo, Promises/async-await, transacciones
- Compatible Firebird 2.5, 3.0, 4.0, 5.0 via wire protocol
- Mantenimiento activo (~100k descargas/semana)
- **Validado en producciÃ³n** por el usuario

**Arquitectura: PatrÃ³n Adapter para Drivers**  
El core del ORM **NO depende directamente de `node-firebird`**. Se define una interfaz `IDriverAdapter` en `src/core/driver-adapter.ts` que abstrae:

- `connect(config)` â†’ `Connection`
- `createPool(config)` â†’ `Pool`
- `execute(connection, sql, params)` â†’ `Result`
- `startTransaction(connection)` â†’ `Transaction`
- `commit/rollback(transaction)`
- `close(connection/pool)`

ImplementaciÃ³n inicial: `NodeFirebirdAdapter` en `src/adapters/node-firebird/`.
Futuro: `NativeDriverAdapter` para `node-firebird-driver-native` sin tocar el core.

---

## 2. Versiones Soportadas (v1.0.0)

**Fecha:** 2026-11-13  
**DecisiÃ³n:**

- Node.js: **â‰¥ 18 LTS** (Hydrogen, Iron, Jod)
- Firebird: **3.0+** (4.0, 5.0 full support); 2.5 best-effort

**Rationale:**

- Node 18+: ESM nativo, fetch, crypto, larga vida LTS
- Firebird 3.0+: BOOLEAN, RETURNING, sintaxis moderna
- FB 2.5: Solo si no requiere features modernas (generators+triggers para PK)

**Estrategia de compatibilidad:** DetecciÃ³n automÃ¡tica de versiÃ³n al conectar â†’ adapta dialecto SQL

---

## 3. API PÃºblica - Estilo de DefiniciÃ³n de Modelos

**Fecha:** 2026-11-13  
**DecisiÃ³n:** **JavaScript nativo first** (ESM + CommonJS dual) â€” TypeScript se aÃ±ade en fase posterior

**API JavaScript (Ãºnica por ahora):**

```javascript
// Factory function (estilo Sequelize clÃ¡sico)
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

**Por quÃ©:**

- Usuario prefiere JS nativo para arrancar
- JSDoc + `.d.ts` generados luego para soporte TS opcional
- Menos tooling inicial, iteraciÃ³n mÃ¡s rÃ¡pida
- API idÃ©ntica a la que tendrÃ­a con clases TS, solo sin decoradores

---

## 4. Estrategia de Claves Primarias (Auto-incremento)

**Fecha:** 2026-11-13  
**DecisiÃ³n:** **DetecciÃ³n automÃ¡tica por versiÃ³n de Firebird**

- FB 4.0+: `IDENTITY` column (nativo, estÃ¡ndar SQL)
- FB 2.5/3.0: `GENERATOR` + `BEFORE INSERT TRIGGER` (tradicional)

**API unificada:**

```typescript
@PrimaryKey @AutoIncrement @Column(DataTypes.INTEGER) declare id: number;
// O con generador custom:
@Column({ type: DataTypes.INTEGER, autoIncrement: true, generatorName: 'GEN_MY_ID' })
```

**Ventaja:** Desarrollador no preocupa por versiÃ³n FB; ORM genera DDL correcto en `sync()` y migraciones.

---

## 5. RETURNING Clause

**Fecha:** 2026-11-13  
**DecisiÃ³n:** Soporte nativo en FB 3.0+ para INSERT/UPDATE/DELETE

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
**DecisiÃ³n:** Dos APIs complementarias

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

## 7. PaginaciÃ³n

**Fecha:** 2026-11-13  
**DecisiÃ³n:** API unificada `limit`/`offset` â†’ SQL adaptado por versiÃ³n

| Firebird  | SQL Generado                    |
| --------- | ------------------------------- |
| 2.5 / 3.0 | `SELECT ... ROWS 20 TO 40`      |
| 4.0+      | `SELECT ... LIMIT 20 OFFSET 40` |

**Cursor-based** para datasets grandes: `where: { id: { [Op.gt]: lastId } }, limit: 20, order: [['id', 'ASC']]`

---

## 8. Mapeo de Tipos de Datos (Firebird â†” DataTypes â†” JS)

| Firebird     | DataTypes    | JS Type           | Notas                          |
| ------------ | ------------ | ----------------- | ------------------------------ |
| INTEGER      | INTEGER      | number            | 32-bit                         |
| BIGINT       | BIGINT       | bigint \| number  | 64-bit                         |
| NUMERIC(p,s) | DECIMAL(p,s) | **string**        | PrecisiÃ³n exacta â†’ string      |
| VARCHAR(n)   | STRING(n)    | string            |                                |
| BLOB TEXT    | TEXT         | string            |                                |
| BLOB BINARY  | BLOB         | Buffer            |                                |
| DATE         | DATEONLY     | Date (solo fecha) |                                |
| TIMESTAMP    | DATE         | Date              |                                |
| BOOLEAN      | BOOLEAN      | boolean           | FB 3.0+ (FB 2.5: SMALLINT 0/1) |
| UUID         | UUID         | string            | FB 4.0+ nativo                 |

**DecisiÃ³n clave:** `DECIMAL/NUMERIC` â†’ **string** en JS para evitar pÃ©rdida de precisiÃ³n.

---

## 9. Estructura Modular del Proyecto

**Fecha:** 2026-11-13  
**DecisiÃ³n:** Arquitectura por capas en `src/`

```
src/
â”œâ”€â”€ core/           # Sequelize, ConnectionManager, Dialect, VersionDetector
â”œâ”€â”€ models/         # Model, DataTypes, Decorators, Hooks, Validations, Associations
â”œâ”€â”€ query/          # QueryBuilder, QueryGenerator, Operators, Functions
â”œâ”€â”€ transactions/   # Transaction, CLS (opcional)
â”œâ”€â”€ migrations/     # Migrator, Migration, CLI, Storage
â”œâ”€â”€ utils/          # Logger, Helpers, SqlEscape
â””â”€â”€ types/          # Tipos TypeScript pÃºblicos
```

**Principio:** SeparaciÃ³n de responsabilidades, cada mÃ³dulo testeable independientemente.

---

## 10. ProtecciÃ³n contra SQL Injection

**Fecha:** 2026-11-13  
**DecisiÃ³n:** **ParametrizaciÃ³n obligatoria** en todas las APIs

```typescript
// QueryBuilder - SIEMPRE parÃ¡metros
User.findAll({ where: { username: input } }); // WHERE username = ?

// Raw queries - SOLO con bind/replacements
sequelize.query('SELECT * FROM users WHERE username = $1', { bind: [input] });

// Identificadores dinÃ¡micos - escapeIdentifier
sequelize.query(`SELECT * FROM ${sequelize.escapeIdentifier(table)} WHERE id = ?`, {
  replacements: [id],
});
```

**Reglas:**

- âŒ Nunca concatenar en where/order/group
- âœ… Op.like, Op.in, etc. usan parÃ¡metros internamente
- âœ… ValidaciÃ³n de esquema en define() previene inyecciÃ³n en DDL

---

## 11. Testing Strategy

**Fecha:** 2026-11-13  
**DecisiÃ³n:** Dual layer

| Tipo        | Tool          | Target                                                           |
| ----------- | ------------- | ---------------------------------------------------------------- |
| Unit        | Jest          | QueryGenerator, DataTypes, Model logic, Associations (mocked)    |
| Integration | Jest + Docker | CRUD real, Transactions, Hooks, Migrations contra FB 3.0/4.0/5.0 |

**Matrix CI:** Firebird 3.0, 4.0, 5.0 (contenedores Docker)
**Cobertura objetivo:** > 85%

---

## 12. Build y PublicaciÃ³n NPM

**Fecha:** 2026-11-13  
**DecisiÃ³n:** Dual package (ESM + CJS) + TypeScript declarations

```
dist/
â”œâ”€â”€ esm/          # ESM modules (package.json "type": "module")
â”œâ”€â”€ cjs/          # CommonJS (transpilado)
â””â”€â”€ types/        # .d.ts files
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
**DecisiÃ³n:** Binario `firebird-orm` incluido en paquete

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
**DecisiÃ³n:** Hooks en instancia y clase, validaciones sync/async

**Hooks ciclo de vida:**

- Instance: beforeValidate, afterValidate, beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDestroy, afterDestroy
- Bulk: beforeBulkCreate, afterBulkCreate, beforeBulkUpdate, afterBulkUpdate, beforeBulkDestroy, afterBulkDestroy
- Query: beforeFind, afterFind

**Validaciones:** Built-in (isEmail, len, isIn, notNull, isNumeric, custom) + async custom validators

---

## 15. Logging y Debug

**Fecha:** 2026-11-13  
**DecisiÃ³n:** Configurable en constructor

```typescript
new Sequelize({
  logging: console.log, // default
  logging: false, // desactivar
  logging: (sql, time) => customLogger(sql, time), // custom
});
```

---

_Ãšltima actualizaciÃ³n: 2026-11-13 - AnÃ¡lisis tÃ©cnico completo aprobado para Fase 0_

## 4. GestiÃ³n de Transacciones

**Fecha:** 2026-11-18  
**DecisiÃ³n:** 
- Reserva de conexiÃ³n fÃ­sica exclusiva por transacciÃ³n hasta COMMIT/ROLLBACK.
- Uso de estados internos en objeto Transaction para prevenir operaciones invÃ¡lidas.
- PropagaciÃ³n explÃ­cita mediante parÃ¡metro  en API CRUD.
- Cada instancia de Sequelize administra su propio pool de conexiones.

## 4. Gestión de Transacciones

**Fecha:** 2026-11-18  
**Decisión:** 
- Reserva de conexión física exclusiva por transacción hasta COMMIT/ROLLBACK.
- Uso de estados internos en objeto Transaction para prevenir operaciones inválidas.
- Propagación explícita mediante parámetro { transaction: t } en API CRUD.
- Cada instancia de Sequelize administra su propio pool de conexiones.
