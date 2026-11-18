import { pool } from 'node-firebird';
import { IDriverAdapter } from '../../core/driver-adapter.js';

/**
 * Adaptador para el driver 'node-firebird'
 * @implements {IDriverAdapter}
 */
export class NodeFirebirdAdapter extends IDriverAdapter {
  /**
   * Crea un pool de conexiones usando node-firebird
   * @param {object} config
   */
  async createPool(config) {
    // node-firebird usa un pool interno simple
    // config.max define el tamaño máximo del pool
    return pool(config.max || 10, {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
    });
  }

  /**
   * Ejecuta una consulta SQL usando el pool (para consultas autónomas)
   * @param {object} poolInstance
   * @param {string} sql
   * @param {Array<any>} params
   */
  async execute(poolInstance, sql, params = []) {
    return new Promise((resolve, reject) => {
      poolInstance.get((err, db) => {
        if (err) return reject(err);

        db.query(sql, params, (err, result) => {
          db.detach(); // Devolver conexión al pool
          if (err) return reject(err);
          resolve(result);
        });
      });
    });
  }

  /**
   * Reserva una conexión del pool para transacciones.
   * La conexión NO se devuelve al pool automáticamente (no se hace detach).
   * @param {object} poolInstance
   * @returns {Promise<object>} Conexión reservada
   */
  async reserveConnection(poolInstance) {
    return new Promise((resolve, reject) => {
      poolInstance.get((err, db) => {
        if (err) return reject(err);
        // NO hacemos detach() aquí, la conexión se queda reservada
        resolve(db);
      });
    });
  }

  /**
   * Libera una conexión reservada y la devuelve al pool
   * @param {object} connection - Conexión reservada (instancia db de node-firebird)
   */
  async releaseConnection(connection) {
    if (connection && typeof connection.detach === 'function') {
      connection.detach();
    }
  }

  /**
   * Inicia una transacción en una conexión reservada
   * @param {object} connection - Conexión reservada
   * @returns {Promise<object>} - Objeto de transacción de node-firebird
   */
  async startTransaction(connection) {
    return new Promise((resolve, reject) => {
      connection.transaction(fb => {
        if (!fb) return reject(new Error('Failed to start transaction'));
        resolve(fb);
      });
    });
  }

  /**
   * Confirma una transacción
   * @param {object} transaction - Objeto de transacción
   */
  async commit(transaction) {
    return new Promise((resolve, reject) => {
      transaction.commit(err => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Revierte una transacción
   * @param {object} transaction - Objeto de transacción
   */
  async rollback(transaction) {
    return new Promise((resolve, reject) => {
      transaction.rollback(err => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async close(poolInstance) {
    return new Promise((resolve) => {
      poolInstance.destroy();
      resolve();
    });
  }
}
