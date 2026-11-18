# CLAUDE.md - firebird-orm Project Instructions

## Project Overview

**Nombre:** firebird-orm  
**Objetivo:** ORM independiente para Node.js targeting Firebird, publicado en npm  
**API:** Inspirada en Sequelize, adaptada a Firebird  
**Estado actual:** Fase 0 - Esperando aprobación para iniciar implementación

---

## Tech Stack Decidido

| Componente      | Decisión                                                              |
| --------------- | --------------------------------------------------------------------- |
| **Driver**      | `node-firebird` (pure JS, wire protocol)                              |
| **Runtime**     | Node.js ≥ 18 LTS                                                      |
| **Target FB**   | 3.0+ (4.0, 5.0 full); 2.5 best-effort                                 |
| **Language**    | **JavaScript nativo** (ESM + CJS dual) — TypeScript en fase posterior |
| **Testing**     | Jest + Docker (FB 3.0, 4.0, 5.0 matrix)                               |
| **Lint/Format** | ESLint + Prettier                                                     |
| **CI/CD**       | GitHub Actions                                                        |

---

## Arquitectura (Resumen)

```
src/
├── core/           # Sequelize, ConnectionManager, Dialect, VersionDetector, DriverAdapter
├── query/          # QueryBuilder, QueryGenerator, Operators, Functions
├── transactions/   # Transaction, CLS
├── migrations/     # Migrator, Migration, CLI, Storage
├── adapters/       # node-firebird/ (NodeFirebirdAdapter)
├── utils/          # Logger, Helpers, SqlEscape
└── types/          # JSDoc typedefs públicos
```

---

## API Pública Principal

```javascript
// Entry point exports
import {
  Sequelize,
  Model,
  DataTypes,
  HasMany,
  BelongsTo,
  HasOne,
  BelongsToMany,
  Op,
  fn,
  col,
  literal,
  Transaction,
  Migration,
  Migrator,
  ValidationError,
  DatabaseError,
} from 'firebird-orm';
```

**Estilo modelos:** Factory function `sequelize.define()` — sin decoradores

```javascript
const User = sequelize.define(
  'User',
  {
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    birthday: { type: DataTypes.DATE, field: 'birth_date' },
  },
  { tableName: 'users', timestamps: true }
);
```

**Tipado:** JSDoc en código → `.d.ts` generados en fase TypeScript posterior

---

## Decisiones Críticas Registradas

Ver `DECISIONS.md` para detalle completo:

1. Driver: `node-firebird` (zero native deps)
2. PK strategy: Auto-detect IDENTITY (FB4+) / Generator+Trigger (FB2.5/3)
3. SQL Injection: Parametrización obligatoria en todo el API
4. Paginación: API unificada → SQL adaptado por versión FB
5. DECIMAL/NUMERIC → string en JS (precisión exacta)
6. Build: Dual ESM/CJS + .d.ts declarations
7. Testing: Unit (mocked) + Integration (Docker real FB)

---

## Roadmap (10 Fases)

| Fase | Descripción                                                 | Duración est. |
| ---- | ----------------------------------------------------------- | ------------- |
| 0    | Fundación: repo, tooling, CI, Docker matrix                 | 1 semana      |
| 1    | Conexión: ConnectionManager, Dialect, VersionDetector       | 1 semana      |
| 2    | Modelos: DataTypes, Model, Decoradores, define(), sync()    | 1 semana      |
| 3    | Query/CRUD: QueryGenerator, QueryBuilder, Op, CRUD completo | 1 semana      |
| 4    | Relaciones: HasMany, BelongsTo, HasOne, BelongsToMany       | 1 semana      |
| 5    | Transacciones + Hooks + Validaciones                        | 1 semana      |
| 6    | Migraciones + CLI                                           | 1 semana      |
| 7    | Consultas nativas + Utilidades SQL                          | 1 semana      |
| 8    | Testing exhaustivo, Docs, Ejemplos                          | 1 semana      |
| 9    | Build dual, npm publish, Release                            | 1 semana      |

---

## Reglas de Desarrollo (Obligatorias)

1. **No escribir código sin aprobación explícita de fase**
2. **No instalar dependencias hasta Fase 0 aprobada**
3. **Tests primero (TDD) en cada fase**
4. **Documentar decisiones en DECISIONS.md**
5. **Actualizar WORKLOG.md al completar cada fase**
6. **Cobertura > 85% antes de merge**
7. **ESM + CJS compatibilidad en todo código**
8. **Parametrización obligatoria - cero concatenación SQL**

---

## Comandos Útiles (cuando proyecto existe)

```bash
# Desarrollo
npm run dev          # Watch mode + test
npm run build        # Build ESM + CJS + types
npm run test         # Unit tests
npm run test:int     # Integration tests (requiere Docker)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit

# Migraciones (cuando implementado)
npx firebird-orm migration:create nombre
npx firebird-orm migration:up
npx firebird-orm migration:down

# Release
npm run release:dry  # Dry-run publish
npm run release      # Publicar + GitHub Release
```

---

## Estructura de Archivos de Memoria

- `WORKLOG.md` - Avances, estado actual, tareas pendientes
- `DECISIONS.md` - Decisiones técnicas con justificación
- `CLAUDE.md` - Este archivo (instrucciones del proyecto)

---

## Contacto / Contexto

- Usuario: Desarrollador experimentado, quiere ORM production-ready
- Prioridad: Calidad, mantenibilidad, compatibilidad Firebird real
- Comunicación: Español, técnico, decisiones explicadas

---

_Última actualización: 2026-11-13 - Post análisis técnico completo_
