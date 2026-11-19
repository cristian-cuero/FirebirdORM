/**
 * Interfaz/Contrato para adaptadores de drivers de base de datos.
 * Esta clase define los métodos que cualquier driver de Firebird debe implementar
 * para ser compatible con firebird-orm.
 *
 * @interface IDriverAdapter
 */
export class IDriverAdapter {
  /**
   * Conecta a la base de datos o crea un pool.
   * @param {object} config - Configuración de conexión (host, port, database, user, password, etc.)
   */
  async createPool(config) {
    throw new Error('Method createPool() must be implemented');
  }

  /**
   * Ejecuta una consulta SQL.
   * @param {object} connection - Conexión o pool de conexión
   * @param {string} sql - Sentencia SQL
   * @param {Array<any>} params - Parámetros para la consulta
   * @returns {Promise<any>} - Resultado de la ejecución
   */
  async execute(connection, sql, params = []) {
    throw new Error('Method execute() must be implemented');
  }

  /**
   * Reserva una conexión del pool.
   * @param {object} pool - Instancia del pool
   * @returns {Promise<object>} - Conexión reservada
   */
  async reserveConnection(pool) {
    throw new Error('Method reserveConnection() must be implemented');
  }

  /**
   * Libera una conexión reservada.
   * @param {object} connection - Conexión reservada
   */
  async releaseConnection(connection) {
    throw new Error('Method releaseConnection() must be implemented');
  }

  /**
   * Inicia una transacción.
   * @param {object} connection - Conexión activa
   */
  async startTransaction(connection) {
    throw new Error('Method startTransaction() must be implemented');
  }

  /**
   * Confirma una transacción.
   * @param {object} connection - Conexión activa con transacción
   */
  async commit(connection) {
    throw new Error('Method commit() must be implemented');
  }

  /**
   * Revierte una transacción.
   * @param {object} connection - Conexión activa con transacción
   */
  async rollback(connection) {
    throw new Error('Method rollback() must be implemented');
  }

  /**
   * Cierra la conexión o el pool.
   * @param {object} connection - Conexión o pool
   */
  async close(connection) {
    throw new Error('Method close() must be implemented');
  }
}
