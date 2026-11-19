/**
 * Representa una transacción en Firebird.
 */
export class Transaction {
  constructor(connectionManager) {
    this.connectionManager = connectionManager;
    this.connection = null;
    this.state = 'IDLE'; // IDLE, ACTIVE, COMMITTED, ROLLED_BACK, FAILED
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
