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
   * Inicia una transacción nativa en la conexión reservada
   * Almacena la transacción nativa en connection.__nativeTransaction
   * @param {object} connection - Conexión reservada
   */
  async startTransaction(connection) {
    return new Promise((resolve, reject) => {
      connection.transaction({}, (err, fb) => {
        if (err) return reject(err);
        if (!fb) return reject(new Error('Failed to start transaction'));
        connection.__nativeTransaction = fb;
        resolve();
      });
    });
  }

  /**
   * Confirma la transacción nativa almacenada en la conexión
   * @param {object} connection - Conexión con transacción activa
   */
  async commit(connection) {
    const tx = connection.__nativeTransaction;
    if (!tx) throw new Error('No active transaction on this connection');
    return new Promise((resolve, reject) => {
      tx.commit(err => {
        if (err) return reject(err);
        delete connection.__nativeTransaction;
        resolve();
      });
    });
  }

  /**
   * Revierte la transacción nativa almacenada en la conexión
   * @param {object} connection - Conexión con transacción activa
   */
  async rollback(connection) {
    const tx = connection.__nativeTransaction;
    if (!tx) throw new Error('No active transaction on this connection');
    return new Promise((resolve, reject) => {
      tx.rollback(err => {
        if (err) return reject(err);
        delete connection.__nativeTransaction;
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
