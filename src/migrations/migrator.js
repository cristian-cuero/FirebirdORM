import { QueryInterface } from './query-interface.js';
import { DataTypes } from '../core/data-types.js';

const META_TABLE = 'firebird_orm_meta';

/**
 * Migrator - Orquesta la ejecución de migraciones
 * - Gestiona la tabla de control de versiones (firebird_orm_meta)
 * - Ejecuta migraciones en orden (up/down)
 * - Controla transacciones por migración
 */
export class Migrator {
  constructor(sequelize, options = {}) {
    this.sequelize = sequelize;
    this.migrationsPath = options.migrationsPath || './migrations';
    this.queryInterface = new QueryInterface(sequelize);
  }

  /**
   * Inicializa la tabla de metadatos si no existe
   */
  async init() {
    const exists = await this.queryInterface.tableExists(META_TABLE);
    if (!exists) {
      await this.queryInterface.createTable(META_TABLE, {
        name: { type: DataTypes.STRING(255), primaryKey: true },
        executed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: new Date() }
      });
      // Fallback por si falla el default
      await this.sequelize.query(`ALTER TABLE "${META_TABLE}" ALTER "executed_at" SET DEFAULT CURRENT_TIMESTAMP`);
    }
  }

  /**
   * Obtiene la lista de migraciones ya ejecutadas
   */
  async getExecutedMigrations() {
    await this.init();
    const rows = await this.sequelize.query(
      `SELECT name FROM "${META_TABLE}" ORDER BY name ASC`
    );
    return rows
      .map(r => r.name || r.NAME)
      .sort(); // Ordenar alfabéticamente como seguridad adicional
  }

  /**
   * Carga los archivos de migración del directorio
   * Ordenados alfabéticamente (timestamp al inicio del nombre)
   */
  async loadMigrations() {
    const fs = await import('fs');
    const path = await import('path');

    const fullPath = path.resolve(this.migrationsPath);

    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const files = fs.readdirSync(fullPath)
      .filter(f => f.endsWith('.js') || f.endsWith('.ts'))
      .sort(); // Orden alfabético = orden cronológico si usan timestamp

    const migrations = [];
    for (const file of files) {
      const filePath = path.join(fullPath, file);
      const mod = await import(`file://${filePath}`);
      const migration = mod.default || mod;

      // Si es una clase que extiende Migration, instanciarla
      let instance;
      if (typeof migration === 'function' && migration.prototype instanceof Migration) {
        instance = new migration();
      } else if (typeof migration === 'object' && migration.up && migration.down) {
        instance = migration;
      } else {
        console.warn(`Migración inválida ignorada: ${file}`);
        continue;
      }

      migrations.push({
        name: file,
        instance,
        up: instance.up.bind(instance),
        down: instance.down.bind(instance)
      });
    }

    return migrations;
  }

  /**
   * Ejecuta las migraciones pendientes (up)
   */
  async up() {
    await this.init();

    const executed = await this.getExecutedMigrations();
    const allMigrations = await this.loadMigrations();

    const pending = allMigrations.filter(m => !executed.includes(m.name));

    if (pending.length === 0) {
      console.log('No hay migraciones pendientes.');
      return [];
    }

    console.log(`Ejecutando ${pending.length} migraciones...`);

    const executedNames = [];

    for (const migration of pending) {
      console.log(`  -> ${migration.name} (up)`);

      // Ejecutar en transacción para atomicidad
      const conn = await this.sequelize.connectionManager.reserveConnection();
      const tx = await this.sequelize.connectionManager.startTransaction(conn);

      try {
        await migration.up(this.queryInterface);

        // Registrar como ejecutada
        await this.sequelize.query(
          `INSERT INTO "${META_TABLE}" (name, executed_at) VALUES (?, CURRENT_TIMESTAMP)`,
          [migration.name],
          { transaction: tx }
        );

        await this.sequelize.connectionManager.commit(tx, conn);
        this.sequelize.connectionManager.releaseConnection(conn);

        executedNames.push(migration.name);
        console.log(`     OK`);
      } catch (error) {
        await this.sequelize.connectionManager.rollback(tx, conn);
        this.sequelize.connectionManager.releaseConnection(conn);
        console.error(`     ERROR: ${error.message}`);
        throw error;
      }
    }

    console.log('Migraciones completadas.');
    return executedNames;
  }

  /**
   * Revierte la última migración (o N migraciones)
   */
  async down(count = 1) {
    await this.init();

    const executed = await this.getExecutedMigrations();
    const allMigrations = await this.loadMigrations();

    // Filtrar solo las que están ejecutadas y ordenar descendente
    const toRollback = allMigrations
      .filter(m => executed.includes(m.name))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, count);

    if (toRollback.length === 0) {
      console.log('No hay migraciones para revertir.');
      return [];
    }

    console.log(`Revierte ${toRollback.length} migraciones...`);

    const revertedNames = [];

    for (const migration of toRollback) {
      console.log(`  <- ${migration.name} (down)`);

      const conn = await this.sequelize.connectionManager.reserveConnection();
      const tx = await this.sequelize.connectionManager.startTransaction(conn);

      try {
        await migration.down(this.queryInterface);

        // Eliminar de la tabla de control
        await this.sequelize.query(
          `DELETE FROM "${META_TABLE}" WHERE name = ?`,
          [migration.name],
          { transaction: tx }
        );

        await this.sequelize.connectionManager.commit(tx, conn);
        this.sequelize.connectionManager.releaseConnection(conn);

        revertedNames.push(migration.name);
        console.log(`     OK`);
      } catch (error) {
        await this.sequelize.connectionManager.rollback(tx, conn);
        this.sequelize.connectionManager.releaseConnection(conn);
        console.error(`     ERROR: ${error.message}`);
        throw error;
      }
    }

    console.log('Rollback completado.');
    return revertedNames;
  }

  /**
   * Muestra el estado de las migraciones
   */
  async status() {
    await this.init();

    const executed = await this.getExecutedMigrations();
    const allMigrations = await this.loadMigrations();

    console.log('\nEstado de Migraciones:');
    console.log('=======================');

    for (const migration of allMigrations) {
      const isExecuted = executed.includes(migration.name);
      const status = isExecuted ? '[X] EJECUTADA' : '[ ] PENDIENTE';
      console.log(`  ${status}  ${migration.name}`);
    }

    console.log('=======================\n');

    return allMigrations.map(m => ({
      name: m.name,
      executed: executed.includes(m.name)
    }));
  }
}