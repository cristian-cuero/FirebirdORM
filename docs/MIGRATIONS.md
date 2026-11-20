# Guía de Migraciones - firebird-orm

El ORM incluye un sistema de migraciones para gestionar los cambios de esquema de forma versionada.

## 1. Crear una migración
Usa el CLI (cuando esté implementado en la fase CLI) o crea el archivo manualmente en tu carpeta de migraciones:

```javascript
// migrations/001-initial-schema.js
import { Migration } from 'firebird-orm';

export default class InitialSchema extends Migration {
  async up(queryInterface) {
    await queryInterface.createTable('users', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      name: { type: DataTypes.STRING(50) }
    });
  }

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  }
}
```

## 2. Ejecución
El `Migrator` utiliza una tabla `firebird_orm_meta` para rastrear qué archivos ya fueron ejecutados.

### Métodos del Migrator
*   `migrator.up()`: Ejecuta todas las migraciones pendientes en orden alfabético/numérico.
*   `migrator.down({ count: N })`: Revierte las últimas N migraciones.
*   `migrator.status()`: Muestra qué migraciones han sido ejecutadas y cuáles están pendientes.

## 3. QueryInterface
El objeto `queryInterface` permite operaciones DDL seguras (parametrizadas internamente):
*   `createTable(tableName, attributes)`
*   `dropTable(tableName)`
*   `addColumn(tableName, attributeName, dataType)`
*   `removeColumn(tableName, attributeName)`
*   `addIndex(tableName, attributes, options)`
