import { NodeFirebirdAdapter } from '../../../src/adapters/node-firebird/index.js';

describe('NodeFirebirdAdapter', () => {
  let adapter;
  let mockPool;
  let mockDb;
  let mockTransaction;

  beforeEach(() => {
    adapter = new NodeFirebirdAdapter();

    mockTransaction = {
      commit: jest.fn((cb) => cb(null)),
      rollback: jest.fn((cb) => cb(null))
    };

    mockDb = {
      query: jest.fn((sql, params, cb) => cb(null, [{ '1': 1 }])),
      detach: jest.fn(),
      transaction: jest.fn((config, cb) => cb(null, mockTransaction))
    };

    mockPool = {
      get: jest.fn((cb) => cb(null, mockDb)),
      destroy: jest.fn()
    };
  });

  describe('createPool', () => {
    test('should create pool with correct config', async () => {
      // node-firebird pool is a function, we can't easily mock it without integration
      // This test documents the expected interface
      expect(typeof adapter.createPool).toBe('function');
    });
  });

  describe('execute', () => {
    test('should get connection from pool, execute query, and detach when given pool', async () => {
      const result = await adapter.execute(mockPool, 'SELECT 1', []);

      expect(mockPool.get).toHaveBeenCalled();
      expect(mockDb.query).toHaveBeenCalledWith('SELECT 1', [], expect.any(Function));
      expect(mockDb.detach).toHaveBeenCalled();
      expect(result).toEqual([{ '1': 1 }]);
    });

    test('should execute directly on reserved connection without detach', async () => {
      const result = await adapter.execute(mockDb, 'SELECT 1', []);

      expect(mockPool.get).not.toHaveBeenCalled();
      expect(mockDb.query).toHaveBeenCalledWith('SELECT 1', [], expect.any(Function));
      expect(mockDb.detach).not.toHaveBeenCalled();
      expect(result).toEqual([{ '1': 1 }]);
    });

    test('should reject on pool get error', async () => {
      mockPool.get.mockImplementationOnce((cb) => cb(new Error('Pool exhausted')));

      await expect(adapter.execute(mockPool, 'SELECT 1', [])).rejects.toThrow('Pool exhausted');
    });

    test('should reject on query error', async () => {
      mockDb.query.mockImplementationOnce((sql, params, cb) => cb(new Error('Query failed')));

      await expect(adapter.execute(mockPool, 'SELECT 1', [])).rejects.toThrow('Query failed');
      expect(mockDb.detach).toHaveBeenCalled();
    });

    test('should reject on reserved connection query error', async () => {
      mockDb.query.mockImplementationOnce((sql, params, cb) => cb(new Error('Query failed')));

      await expect(adapter.execute(mockDb, 'SELECT 1', [])).rejects.toThrow('Query failed');
      expect(mockDb.detach).not.toHaveBeenCalled();
    });
  });

  describe('reserveConnection', () => {
    test('should get connection from pool without detach', async () => {
      const conn = await adapter.reserveConnection(mockPool);

      expect(mockPool.get).toHaveBeenCalled();
      expect(conn).toBe(mockDb);
      expect(mockDb.detach).not.toHaveBeenCalled();
    });

    test('should reject on pool get error', async () => {
      mockPool.get.mockImplementationOnce((cb) => cb(new Error('Pool exhausted')));

      await expect(adapter.reserveConnection(mockPool)).rejects.toThrow('Pool exhausted');
    });
  });

  describe('releaseConnection', () => {
    test('should call detach on valid connection', async () => {
      await adapter.releaseConnection(mockDb);
      expect(mockDb.detach).toHaveBeenCalled();
    });

    test('should handle null connection gracefully', async () => {
      await expect(adapter.releaseConnection(null)).resolves.toBeUndefined();
    });

    test('should handle connection without detach method', async () => {
      await expect(adapter.releaseConnection({})).resolves.toBeUndefined();
    });
  });

  describe('startTransaction', () => {
    test('should start native transaction and store it on connection', async () => {
      await adapter.startTransaction(mockDb);

      expect(mockDb.transaction).toHaveBeenCalledWith({}, expect.any(Function));
      expect(mockDb.__nativeTransaction).toBe(mockTransaction);
    });

    test('should reject if transaction fails to start', async () => {
      mockDb.transaction.mockImplementationOnce((config, cb) => cb(new Error('Transaction start failed')));

      await expect(adapter.startTransaction(mockDb)).rejects.toThrow('Transaction start failed');
    });

    test('should reject if transaction returns null', async () => {
      mockDb.transaction.mockImplementationOnce((config, cb) => cb(null, null));

      await expect(adapter.startTransaction(mockDb)).rejects.toThrow('Failed to start transaction');
    });
  });

  describe('commit', () => {
    test('should commit native transaction and clean up', async () => {
      mockDb.__nativeTransaction = mockTransaction;

      await adapter.commit(mockDb);

      expect(mockTransaction.commit).toHaveBeenCalledWith(expect.any(Function));
      expect(mockDb.__nativeTransaction).toBeUndefined();
    });

    test('should reject if no active transaction', async () => {
      await expect(adapter.commit(mockDb)).rejects.toThrow('No active transaction on this connection');
    });

    test('should reject on commit error and clean up', async () => {
      mockDb.__nativeTransaction = mockTransaction;
      mockTransaction.commit.mockImplementationOnce((cb) => cb(new Error('Commit failed')));

      await expect(adapter.commit(mockDb)).rejects.toThrow('Commit failed');
      expect(mockDb.__nativeTransaction).toBeUndefined();
    });
  });

  describe('rollback', () => {
    test('should rollback native transaction and clean up', async () => {
      mockDb.__nativeTransaction = mockTransaction;

      await adapter.rollback(mockDb);

      expect(mockTransaction.rollback).toHaveBeenCalledWith(expect.any(Function));
      expect(mockDb.__nativeTransaction).toBeUndefined();
    });

    test('should reject if no active transaction', async () => {
      await expect(adapter.rollback(mockDb)).rejects.toThrow('No active transaction on this connection');
    });

    test('should reject on rollback error and clean up', async () => {
      mockDb.__nativeTransaction = mockTransaction;
      mockTransaction.rollback.mockImplementationOnce((cb) => cb(new Error('Rollback failed')));

      await expect(adapter.rollback(mockDb)).rejects.toThrow('Rollback failed');
      expect(mockDb.__nativeTransaction).toBeUndefined();
    });
  });

  describe('close', () => {
    test('should destroy pool', async () => {
      await adapter.close(mockPool);
      expect(mockPool.destroy).toHaveBeenCalled();
    });
  });
});