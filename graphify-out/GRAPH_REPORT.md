# Graph Report - Prueba De OERM FIREBIRD  (2026-11-19)

## Corpus Check
- Corpus is ~14,849 words - fits in a single context window. You may not need a graph.

## Summary
- 481 nodes · 708 edges · 30 communities (20 shown, 10 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 86 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Core Source Code (AST)
- GitHub Actions CI Pipeline
- Docker Compose Configuration
- Adapter & Transaction Layer
- Associations & Model Factory
- Dialect & Query Generator
- Query Functions & Operators
- TypeScript/JS Config
- Build Scripts
- ESLint Configuration
- NPM Scripts
- Package Metadata
- Dev Dependencies
- CI Firebird Services
- Prettier Configuration
- CI Matrix Strategy
- Prettier (Duplicate)
- Runtime Dependencies
- Publish Config
- Repository Info
- Babel Config
- Bugs URL
- Babel Preset Env
- ESLint Jest Plugin
- Node Engines
- Package Exports

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `scripts` - 18 edges
3. `Association` - 17 edges
4. `QueryGenerator` - 17 edges
5. `DatabaseError` - 14 edges
6. `NodeFirebirdAdapter` - 13 edges
7. `Model` - 13 edges
8. `Dialect` - 12 edges
9. `Sequelize` - 12 edges
10. `HasMany` - 11 edges

## Surprising Connections (you probably didn't know these)
- `createMockModel()` --calls--> `BelongsTo`  [EXTRACTED]
  tests/unit/query/query-generator.test.js → src/core/associations/belongs-to.js
- `createMockModel()` --calls--> `HasMany`  [EXTRACTED]
  tests/unit/query/query-generator.test.js → src/core/associations/has-many.js
- `NodeFirebirdAdapter` --inherits--> `IDriverAdapter`  [EXTRACTED]
  src/adapters/node-firebird/index.js → src/core/driver-adapter.js
- `BelongsTo` --inherits--> `Association`  [EXTRACTED]
  src/core/associations/belongs-to.js → src/core/associations/base.js
- `BelongsToMany` --inherits--> `Association`  [EXTRACTED]
  src/core/associations/belongs-to-many.js → src/core/associations/base.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **decision_impact** — decision:driver-selection, component:node-firebird-adapter, dependency:node-firebird [INFERRED 0.90]
- **decision_impact** — decision:adapter-pattern, component:idriver-adapter, component:node-firebird-adapter [INFERRED 0.95]
- **decision_impact** — decision:versions-supported, component:dialect-query-generator, api:datatypes [INFERRED 0.90]
- **decision_impact** — decision:pk-strategy, component:dialect-query-generator, api:model-class, api:datatypes [INFERRED 0.90]
- **decision_impact** — decision:sql-injection, component:query-builder, component:dialect-query-generator, api:sequelize-class [INFERRED 0.95]
- **enforces** — concept:dev-rules, task:phase-0, task:phase-1, task:phase-2, task:phase-3 [INFERRED 0.90]

## Communities (30 total, 10 thin omitted)

### Community 1 - "Core Source Code (AST)"
Cohesion: 0.08
Nodes (16): DataType, DataTypes, VarDataType, BaseError, ConnectionError, DatabaseError, ExclusionConstraintError, ForeignKeyConstraintError (+8 more)

### Community 2 - "GitHub Actions CI Pipeline"
Cohesion: 0.06
Nodes (46): name, needs, runs-on, steps, env, FB_DATABASE, FB_HOST, FB_PASSWORD (+38 more)

### Community 3 - "Docker Compose Configuration"
Cohesion: 0.07
Nodes (43): FIREBIRD_DATABASE, FIREBIRD_DATABASE_DEFAULT_CHARSET, FIREBIRD_ROOT_PASSWORD, ISC_PASSWORD, container_name, environment, healthcheck, image (+35 more)

### Community 4 - "Adapter & Transaction Layer"
Cohesion: 0.07
Nodes (4): NodeFirebirdAdapter, ConnectionManager, IDriverAdapter, Transaction

### Community 5 - "Associations & Model Factory"
Cohesion: 0.12
Nodes (6): Association, BelongsTo, BelongsToMany, HasMany, HasOne, createMockModel()

### Community 6 - "Dialect & Query Generator"
Cohesion: 0.13
Nodes (3): Dialect, defineModel(), QueryGenerator

### Community 7 - "Query Functions & Operators"
Cohesion: 0.14
Nodes (9): Cast, cast(), Col, col(), Fn, fn(), Literal, literal() (+1 more)

### Community 8 - "TypeScript/JS Config"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, checkJs, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules (+12 more)

### Community 9 - "Build Scripts"
Cohesion: 0.12
Nodes (16): args, CJS_DIR, clean(), copyRecursive(), createDirs(), __dirname, DIST, ESM_DIR (+8 more)

### Community 10 - "ESLint Configuration"
Cohesion: 0.11
Nodes (18): env, es2022, jest, node, extends, ignorePatterns, prettier, parserOptions (+10 more)

### Community 11 - "NPM Scripts"
Cohesion: 0.11
Nodes (18): scripts, build, build:cjs, build:esm, build:types, dev, format, format:check (+10 more)

### Community 12 - "Package Metadata"
Cohesion: 0.15
Nodes (12): author, description, files, homepage, keywords, license, main, module (+4 more)

### Community 13 - "Dev Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @babel/core@^7.24.0, eslint@^8.57.0, eslint-config-prettier@^9.1.0, globals@^15.0.0, jest@^29.7.0, prettier@^3.2.0, prettier (+5 more)

### Community 14 - "CI Firebird Services"
Cohesion: 0.20
Nodes (10): FIREBIRD_DATABASE, FIREBIRD_PASSWORD, FIREBIRD_USER, ISC_PASSWORD, env, image, options, ports (+2 more)

### Community 15 - "Prettier Configuration"
Cohesion: 0.22
Nodes (8): arrowParens, bracketSpacing, endOfLine, printWidth, semi, singleQuote, tabWidth, trailingComma

### Community 16 - "CI Matrix Strategy"
Cohesion: 0.25
Nodes (8): fb-version, image, port, strategy, fb-version, include, fail-fast, matrix

### Community 17 - "Prettier (Duplicate)"
Cohesion: 0.25
Nodes (8): prettier, arrowParens, bracketSpacing, printWidth, semi, singleQuote, tabWidth, trailingComma

### Community 19 - "Runtime Dependencies"
Cohesion: 0.67
Nodes (3): dependencies, node-firebird@^2.0.0, node-firebird

### Community 20 - "Publish Config"
Cohesion: 0.67
Nodes (3): publishConfig, access, registry

### Community 21 - "Repository Info"
Cohesion: 0.67
Nodes (3): repository, type, url

## Knowledge Gaps
- **3 isolated node(s):** `eslint:recommended`, `plugin:jest/recommended`, `prettier`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 242 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `node-firebird` connect `Runtime Dependencies` to `Package Metadata`, `Adapter & Transaction Layer`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **What connects `eslint:recommended`, `plugin:jest/recommended`, `prettier` to the rest of the system?**
  _3 weakly-connected nodes found - possible missing edges._
- **Should `Architecture & API Design` be split into smaller, more focused modules?**
  _Cohesion score 0.061224489795918366 - nodes in this community are weakly interconnected._
- **Why does `scripts` connect `NPM Scripts` to `Package Metadata`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `Core Source Code (AST)` be split into smaller, more focused modules?**
  _Cohesion score 0.07993197278911565 - nodes in this community are weakly interconnected._
- **Why does `QueryGenerator` connect `Dialect & Query Generator` to `Query Functions & Operators`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `GitHub Actions CI Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.058279370952821465 - nodes in this community are weakly interconnected._