import { ConnectionManager } from './connection-manager.js';
import { Dialect } from './dialect.js';
import { defineModel } from './model-factory.js';

/**
 * Clase principal (Fachada) del ORM.
 */
export class Sequelize {
  /**
   * @param {object} config - Configuración de base de datos
   */
  constructor(config) {
    this.connectionManager = new ConnectionManager(config);
    this.dialect = new Dialect(this.connectionManager);
    this.version = null;
    this.models = {};
  }

  /**
   * Inicializa la conexión y detecta la versión
   */
  async init() {
    await this.connectionManager.init();
    this.version = await this.dialect.detectVersion();
  }

  /**
   * Define un modelo
   */
  define(name, attributes, options = {}) {
    const model = defineModel(this, name, attributes, options);
    this.models[name] = model;
    return model;
  }

  /**
   * Ejecuta una consulta SQL nativa
   * @param {string} sql
   * @param {Array<any>} params
   */
  async query(sql, params = []) {
    return this.connectionManager.execute(sql, params);
  }

  /**
   * Cierra las conexiones
   */
  async close() {
    return this.connectionManager.close();
  }
}
