import { Transaction } from '../../../src/transactions/transaction.js';
import { ConnectionManager } from '../../../src/core/connection-manager.js';

describe('Transaction', () => {
  let cm;
  let transaction;
  let mockConnection;
  let mockNativeTransaction;

  beforeEach(() => {
    cm = new ConnectionManager({});

    mockNativeTransaction = {
      commit: jest.fn((cb) => cb(null)),
      rollback: jest.fn((cb) => cb(null))
    };

    mockConnection = {
      transaction: jest.fn((config, cb) => cb(null, mockNativeTransaction)),
      detach: jest.fn()
    };

    cm.reserveConnection = jest.fn().mockResolvedValue(mockConnection);
    cm.releaseConnection = jest.fn().mockResolvedValue(undefined);
    transaction = new Transaction(cm);
  });

  test('should start in IDLE state', () => {
    expect(transaction.state).toBe('IDLE');
  });

  test('should become ACTIVE after start()', async () => {
    await transaction.start();
    expect(transaction.state).toBe('ACTIVE');
    expect(cm.reserveConnection).toHaveBeenCalled();
    expect(mockConnection.transaction).toHaveBeenCalled();
  });

  test('should become COMMITTED after commit()', async () => {
    await transaction.start();
    await transaction.commit();
    expect(transaction.state).toBe('COMMITTED');
    expect(mockNativeTransaction.commit).toHaveBeenCalled();
    expect(cm.releaseConnection).toHaveBeenCalledWith(mockConnection);
  });

  test('should become ROLLED_BACK after rollback()', async () => {
    await transaction.start();
    await transaction.rollback();
    expect(transaction.state).toBe('ROLLED_BACK');
    expect(mockNativeTransaction.rollback).toHaveBeenCalled();
    expect(cm.releaseConnection).toHaveBeenCalledWith(mockConnection);
  });
});
