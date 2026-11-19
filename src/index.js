/**
 * firebird-orm - Main entry point
 * @module firebird-orm
 */

// Core
export { Sequelize } from './core/sequelize.js';
export { Model } from './core/model.js';
export { DataTypes } from './core/data-types.js';

// Associations
// export { HasMany } from './core/associations/has-many.js';
// export { BelongsTo } from './core/associations/belongs-to.js';
// export { HasOne } from './core/associations/has-one.js';
// export { BelongsToMany } from './core/associations/belongs-to-many.js';

// Query
export { Op } from './query/operators.js';
export { fn, col, literal, cast } from './query/functions.js';

// Transactions
export { Transaction } from './transactions/transaction.js';

// Migrations
export { Migration } from './migrations/migration.js';
export { Migrator } from './migrations/migrator.js';
export { QueryInterface } from './migrations/query-interface.js';

// Errors
export {
  BaseError,
  ValidationError,
  DatabaseError,
  ConnectionError,
  TimeoutError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ExclusionConstraintError,
} from './core/errors.js';

// Utils
export { SqlEscape } from './utils/sql-escape.js';

// Version
export { VERSION } from './version.js';
