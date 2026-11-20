/**
 * Representa una transacción en Firebird.
 */
export class Transaction {
  /**
   * @param {ConnectionManager|Sequelize} connectionManagerOrSequelize - ConnectionManager o instancia de Sequelize
   */
  constructor(connectionManagerOrSequelize) {
    // Aceptar tanto ConnectionManager como instancia de Sequelize (para compatibilidad)
    this.connectionManager = connectionManagerOrSequelize.connectionManager || connectionManagerOrSequelize;
    this.connection = null;
    this.state = 'IDLE'; // IDLE, ACTIVE, COMMITTED, ROLLED_BACK, FAILED
  }

  /**
   * Factory method to create and start a transaction in one call.
   * @param {ConnectionManager|Sequelize} connectionManagerOrSequelize
   * @returns {Promise<Transaction>}
   */
  static async start(connectionManagerOrSequelize) {
    const tx = new Transaction(connectionManagerOrSequelize);
    await tx.start();
    return tx;
  }

  async start() {
    if (this.state !== 'IDLE') throw new Error('Transaction already started or finished');

    this.connection = await this.connectionManager.reserveConnection();
    // Iniciar transacción nativa en Firebird (el adaptador lo manejará)
    await this.connectionManager.adapter.startTransaction(this.connection);
    this.state = 'ACTIVE';
  }

  async commit() {
    if (this.state !== 'ACTIVE') throw new Error('Transaction not active');
    try {
      await this.connectionManager.adapter.commit(this.connection);
      this.state = 'COMMITTED';
    } catch (e) {
      this.state = 'FAILED';
      throw e;
    } finally {
      await this.connectionManager.releaseConnection(this.connection);
    }
  }

  async rollback() {
    if (this.state !== 'ACTIVE') throw new Error('Transaction not active');
    try {
      await this.connectionManager.adapter.rollback(this.connection);
      this.state = 'ROLLED_BACK';
    } catch (e) {
      this.state = 'FAILED';
      throw e;
    } finally {
      await this.connectionManager.releaseConnection(this.connection);
    }
  }
}
