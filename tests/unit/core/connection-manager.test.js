import { ConnectionManager } from '../../../src/core/connection-manager.js';
import { NodeFirebirdAdapter } from '../../../src/adapters/node-firebird/index.js';

// Mocking node-firebird pool interaction
jest.mock('../../../src/adapters/node-firebird/index.js');

describe('ConnectionManager', () => {
  let cm;
  let mockAdapter;

  beforeEach(() => {
    mockAdapter = new NodeFirebirdAdapter();
    cm = new ConnectionManager({ host: 'localhost' });
    cm.adapter = mockAdapter;
  });

  test('should reserve a connection without calling detach', async () => {
    const mockDb = { detach: jest.fn() };
    mockAdapter.reserveConnection.mockResolvedValue(mockDb);

    const conn = await cm.reserveConnection();

    expect(conn).toBe(mockDb);
    expect(mockAdapter.reserveConnection).toHaveBeenCalled();
  });

  test('should release a connection by calling detach', async () => {
    const mockDb = { detach: jest.fn() };
    await cm.releaseConnection(mockDb);
    expect(mockAdapter.releaseConnection).toHaveBeenCalledWith(mockDb);
  });
});
