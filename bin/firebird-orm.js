#!/usr/bin/env node
/**
 * CLI de firebird-orm
 *
 * Uso:
 *   npx firebird-orm migration:create nombre-migracion
 *   npx firebird-orm migration:up
 *   npx firebird-orm migration:down
 *   npx firebird-orm migration:status
 *   npx firebird-orm migration:status --all
 */

import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde .env si existe
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env') });

// Importar internos del ORM
import { Sequelize } from '../src/core/sequelize.js';
import { Migrator } from '../src/migrations/migrator.js';
import { DataTypes } from '../src/core/data-types.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subCommand = args[1];

  // Configuración de conexión (desde .env o valores por defecto)
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3050,
    database: process.env.DB_DATABASE || process.env.DB_NAME || '/tmp/firebird/test.fdb',
    user: process.env.DB_USER || 'SYSDBA',
    password: process.env.DB_PASSWORD || 'masterkey',
    lowercase_keys: true,
    role: process.env.DB_ROLE || null,
    pageSize: parseInt(process.env.DB_PAGE_SIZE) || 4096,
    // Pool
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 5,
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
    }
  };

  const migrationsPath = process.env.MIGRATIONS_PATH || './migrations';

  // Mostrar ayuda
  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  // Inicializar Sequelize
  const sequelize = new Sequelize(dbConfig);

  try {
    await sequelize.init();

    const migrator = new Migrator(sequelize, { migrationsPath });

    switch (command) {
      case 'migration:create':
        await handleCreateMigration(subCommand, migrationsPath);
        break;

      case 'migration:up':
        await migrator.up();
        break;

      case 'migration:down':
        const count = parseInt(args[2]) || 1;
        await migrator.down(count);
        break;

      case 'migration:status':
        await migrator.status();
        break;

      default:
        console.error(`Comando desconocido: ${command}`);
        printHelp();
        process.exit(1);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

async function handleCreateMigration(name, migrationsPath) {
  if (!name) {
    console.error('Error: Debes proporcionar un nombre para la migración.');
    console.error('Uso: npx firebird-orm migration:create nombre-descriptivo');
    process.exit(1);
  }

  // Normalizar nombre: timestamp + nombre kebab-case
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fileName = `${timestamp}-${safeName}.js`;

  const fullPath = resolve(process.cwd(), migrationsPath);

  // Crear directorio si no existe
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
    console.log(`Directorio de migraciones creado: ${fullPath}`);
  }

  const filePath = join(fullPath, fileName);

  // Template de migración
  const template = `/**
 * Migración: ${safeName}
 * Fecha: ${new Date().toISOString()}
 */

import { DataTypes } from 'firebird-orm';

export default {
  /**
   * Ejecutar migración (hacia adelante)
   * @param {import('firebird-orm').QueryInterface} queryInterface
   */
  async up(queryInterface) {
    // Ejemplo:
    // await queryInterface.createTable('tu_tabla', {
    //   id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    //   nombre: { type: DataTypes.STRING(100), allowNull: false },
    //   creado_en: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    // });
  },

  /**
   * Revertir migración (hacia atrás)
   * @param {import('firebird-orm').QueryInterface} queryInterface
   */
  async down(queryInterface) {
    // Ejemplo:
    // await queryInterface.dropTable('tu_tabla');
  }
};
`;

  // Escribir archivo
  await import('fs').then(fs => fs.promises.writeFile(filePath, template));

  console.log(`Migración creada: ${filePath}`);
}

function printHelp() {
  console.log(`
firebird-orm CLI - Herramienta de migraciones para Firebird

Uso:
  npx firebird-orm <comando> [opciones]

Comandos:
  migration:create <nombre>    Crea un nuevo archivo de migración con timestamp
  migration:up                 Ejecuta todas las migraciones pendientes
  migration:down [N]           Revierte la última migración (o N migraciones)
  migration:status             Muestra el estado de todas las migraciones

Variables de entorno (.env):
  DB_HOST, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD
  MIGRATIONS_PATH (default: ./migrations)

Ejemplos:
  npx firebird-orm migration:create crear-tabla-usuarios
  npx firebird-orm migration:up
  npx firebird-orm migration:down 1
  npx firebird-orm migration:status
`);
}

main();