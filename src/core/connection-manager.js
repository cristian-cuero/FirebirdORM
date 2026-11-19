import { NodeFirebirdAdapter } from '../adapters/node-firebird/index.js';

/**
 * Gestiona el pool de conexiones y abstrae la comunicación con el adaptador.
 * Implementa patrón Singleton para el pool dentro de una instancia de Sequelize.
 */
export class ConnectionManager {
  /**
   * @param {object} config - Configuración de conexión
   * @param {string} config.host
   * @param {number} config.port
   * @param {string} config.database
   * @param {string} config.user
   * @param {string} config.password
   * @param {number} [config.max=10] - Tamaño máximo del pool de conexiones
   * @param {number} [config.min=0] - Tamaño mínimo del pool (reservado para futuras expansiones)
   */
  constructor(config) {
    this.config = {
      max: 10,
      min: 0,
      ...config
    };
    this.adapter = new NodeFirebirdAdapter();
    this.pool = null;
    this._initialized = false;
  }

  /**
   * Inicializa el pool (solo una vez por instancia)
   */
  async init() {
    if (this._initialized) return;
    this.pool = await this.adapter.createPool(this.config);
    this._initialized = true;
  }

  /**
   * Reserva una conexión del pool para transacciones.
   * La conexión NO se devuelve al pool automáticamente.
   * @returns {Promise<object>} Conexión reservada
   */
  async reserveConnection() {
    if (!this._initialized) await this.init();
    return this.adapter.reserveConnection(this.pool);
  }

  /**
   * Libera una conexión reservada y la devuelve al pool
   * @param {object} connection - Conexión a liberar
   */
  async releaseConnection(connection) {
    if (connection) {
      await this.adapter.releaseConnection(connection);
    }
  }

  /**
   * Inicia una transacción nativa en una conexión reservada
   * @param {object} connection - Conexión reservada
   * @returns {Promise<object>} Transacción nativa
   */
  async startTransaction(connection) {
    return this.adapter.startTransaction(connection);
  }

  /**
   * Ejecuta SQL usando el pool (para consultas fuera de transacción)
   * @param {string} sql
   * @param {Array<any>} params
   * @param {object} [options] - Opciones (transaction, etc.)
   */
  async execute(sql, params = [], options = {}) {
    if (!this._initialized) await this.init();

    // Si hay transacción activa, usar su conexión reservada
    if (options.transaction && options.transaction.connection) {
      return this.adapter.execute(options.transaction.connection, sql, params);
    }

    // Sin transacción: usar pool normal
    return this.adapter.execute(this.pool, sql, params);
  }

  /**
   * Cierra el pool y libera recursos
   */
  async close() {
    if (this.pool) {
      await this.adapter.close(this.pool);
      this.pool = null;
      this._initialized = false;
    }
  }
}
