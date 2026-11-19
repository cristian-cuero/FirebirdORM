import { Migrator } from '../../../src/migrations/migrator.js';
import { Migration } from '../../../src/migrations/migration.js';
import { DataTypes } from '../../../src/core/data-types.js';

describe('Migrator - Migraciones', () => {
  let mockSequelize;
  let mockConnectionManager;
  let mockQueryInterface;
  let migrator;

  beforeEach(() => {
    mockConnectionManager = {
      reserveConnection: jest.fn().mockResolvedValue({}),
      startTransaction: jest.fn().mockResolvedValue({}),
      commit: jest.fn().mockResolvedValue({}),
      rollback: jest.fn().mockResolvedValue({}),
      releaseConnection: jest.fn().mockResolvedValue({})
    };

    mockQueryInterface = {
      tableExists: jest.fn().mockResolvedValue(false),
      createTable: jest.fn().mockResolvedValue([])
    };

    mockSequelize = {
      connectionManager: mockConnectionManager,
      query: jest.fn().mockResolvedValue([]),
      dialect: {}
    };

    // Spy on QueryInterface constructor to inject mock
    jest.spyOn(require('../../../src/migrations/query-interface.js'), 'QueryInterface')
      .mockImplementation(() => mockQueryInterface);

    migrator = new Migrator(mockSequelize, { migrationsPath: '/fake/migrations' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('init', () => {
    test('Debe crear la tabla firebird_orm_meta si no existe', async () => {
      mockQueryInterface.tableExists.mockResolvedValue(false);

      await migrator.init();

      expect(mockQueryInterface.tableExists).toHaveBeenCalledWith('firebird_orm_meta');
      expect(mockQueryInterface.createTable).toHaveBeenCalledWith('firebird_orm_meta', expect.any(Object));
      expect(mockSequelize.query).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE'));
    });

    test('No debe recrear la tabla si ya existe', async () => {
      mockQueryInterface.tableExists.mockResolvedValue(true);

      await migrator.init();

      expect(mockQueryInterface.createTable).not.toHaveBeenCalled();
    });
  });

  describe('getExecutedMigrations', () => {
    test('Debe retornar lista ordenada de migraciones ejecutadas', async () => {
      mockSequelize.query.mockResolvedValue([
        { name: '003-third.js' },
        { name: '001-first.js' },
        { name: '002-second.js' }
      ]);

      const executed = await migrator.getExecutedMigrations();

      expect(executed).toEqual(['001-first.js', '002-second.js', '003-third.js']);
    });

    test('Debe manejar columnas en mayúsculas (Firebird)', async () => {
      mockSequelize.query.mockResolvedValue([
        { NAME: '001-first.js' }
      ]);

      const executed = await migrator.getExecutedMigrations();

      expect(executed).toEqual(['001-first.js']);
    });
  });

  describe('loadMigrations', () => {
    test('Debe retornar array vacío si directorio no existe', async () => {
      jest.spyOn(migrator, 'loadMigrations').mockResolvedValue([]);

      const migrations = await migrator.loadMigrations();

      expect(migrations).toEqual([]);
    });

    test('Debe cargar migraciones como objetos con up/down', async () => {
      const mockMigrations = [
        {
          name: '001-create-users.js',
          up: jest.fn(),
          down: jest.fn(),
          instance: null
        }
      ];

      jest.spyOn(migrator, 'loadMigrations').mockResolvedValue(mockMigrations);

      const migrations = await migrator.loadMigrations();

      expect(migrations).toHaveLength(1);
      expect(migrations[0].name).toBe('001-create-users.js');
      expect(typeof migrations[0].up).toBe('function');
      expect(typeof migrations[0].down).toBe('function');
    });

    test('Debe ignorar archivos no-JS/TS', async () => {
      const mockMigrations = [
        {
          name: '001-test.js',
          up: jest.fn(),
          down: jest.fn(),
          instance: null
        }
      ];

      jest.spyOn(migrator, 'loadMigrations').mockResolvedValue(mockMigrations);

      const migrations = await migrator.loadMigrations();

      expect(migrations).toHaveLength(1);
    });

    test('Debe instanciar clases que extienden Migration', async () => {
      const mockMigrationInstance = new Migration();
      const mockMigrations = [
        {
          name: '001-class.js',
          up: jest.fn(),
          down: jest.fn(),
          instance: mockMigrationInstance
        }
      ];

      jest.spyOn(migrator, 'loadMigrations').mockResolvedValue(mockMigrations);

      const migrations = await migrator.loadMigrations();

      expect(migrations[0].instance).toBeInstanceOf(Migration);
    });
  });

  describe('up', () => {
    test('Debe ejecutar migraciones pendientes en orden', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ name: '001-first.js' }]) // getExecutedMigrations
        .mockResolvedValue([]); // insert into meta table

      mockQueryInterface.tableExists.mockResolvedValue(true);

      const mockMigration2 = { up: jest.fn(), down: jest.fn(), name: '002-second.js' };
      const mockMigration3 = { up: jest.fn(), down: jest.fn(), name: '003-third.js' };

      jest.spyOn(migrator, 'loadMigrations').mockResolvedValue([
        { name: '001-first.js', up: jest.fn(), down: jest.fn() },
        mockMigration2,
        mockMigration3
      ]);

      await migrator.up();

      expect(mockMigration2.up).toHaveBeenCalledWith(mockQueryInterface);
      expect(mockMigration3.up).toHaveBeenCalledWith(mockQueryInterface);
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "firebird_orm_meta"'),
        ['002-second.js'],
        expect.any(Object)
      );
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "firebird_orm_meta"'),
        ['003-third.js'],
        expect.any(Object)
      );
    });

    test('No debe ejecutar nada si no hay migraciones pendientes', async () => {
      mockSequelize.query.mockResolvedValue([
        { name: '001-first.js' },
        { name: '002-second.js' }
      ]);
      mockQueryInterface.tableExists.mockResolvedValue(true);

      jest.spyOn(migrator, 'loadMigrations').mockResolvedValue([
        { name: '001-first.js', up: jest.fn() },
        { name: '002-second.js', up: jest.fn() }
      ]);

      const executed = await migrator.up();

      expect(executed).toEqual([]);
    });

    test('Debe hacer rollback si una migración falla', async () => {
      mockSequelize.query.mockResolvedValue([{ name: '001-first.js' }]);
      mockQueryInterface.tableExists.mockResolvedValue(true);

      const failingMigration = {
        up: jest.fn().mockRejectedValue(new Error('SQL Error')),
        name: '002-fail.js'
      };

      jest.spyOn(migrator, 'loadMigrations').mockResolvedValue([
        { name: '001-first.js', up: jest.fn() },
        failingMigration
      ]);

      await expect(migrator.up()).rejects.toThrow('SQL Error');

      expect(mockConnectionManager.rollback).toHaveBeenCalled();
      expect(mockConnectionManager.releaseConnection).toHaveBeenCalled();
    });
  });

  describe('down', () => {
    test('Debe revertir la última migración ejecutada', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ name: '001-first.js' }, { name: '002-second.js' }]) // getExecutedMigrations
        .mockResolvedValue([]); // delete from meta table

      mockQueryInterface.tableExists.mockResolvedValue(true);

      const mockMigration2 = { down: jest.fn(), name: '002-second.js' };
      const mockMigration1 = { down: jest.fn(), name: '001-first.js' };

      jest.spyOn(migrator, 'loadMigrations').mockResolvedValue([
        mockMigration1,
        mockMigration2
      ]);

      await migrator.down(1);

      expect(mockMigration2.down).toHaveBeenCalledWith(mockQueryInterface);
      expect(mockMigration1.down).not.toHaveBeenCalled();
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM "firebird_orm_meta"'),
        ['002-second.js'],
        expect.any(Object)
      );
    });

    test('Debe revertir N migraciones si se especifica count', async () => {
      mockSequelize.query
        .mockResolvedValueOnce([{ name: '001-first.js' }, { name: '002-second.js' }, { name: '003-third.js' }])
        .mockResolvedValue([])
        .mockResolvedValue([]);

      mockQueryInterface.tableExists.mockResolvedValue(true);

      const m3 = { down: jest.fn(), name: '003-third.js' };
      const m2 = { down: jest.fn(), name: '002-second.js' };
      const m1 = { down: jest.fn(), name: '001-first.js' };

      jest.spyOn(migrator, 'loadMigrations').mockResolvedValue([m1, m2, m3]);

      await migrator.down(2);

      expect(m3.down).toHaveBeenCalled();
      expect(m2.down).toHaveBeenCalled();
      expect(m1.down).not.toHaveBeenCalled();
    });
  });

  describe('status', () => {
    test('Debe mostrar estado correcto de todas las migraciones', async () => {
      mockSequelize.query.mockResolvedValue([{ name: '001-first.js' }]);
      mockQueryInterface.tableExists.mockResolvedValue(true);

      const m1 = { up: jest.fn(), down: jest.fn(), name: '001-first.js' };
      const m2 = { up: jest.fn(), down: jest.fn(), name: '002-second.js' };

      jest.spyOn(migrator, 'loadMigrations').mockResolvedValue([m1, m2]);

      const result = await migrator.status();

      expect(result).toEqual([
        { name: '001-first.js', executed: true },
        { name: '002-second.js', executed: false }
      ]);
    });
  });
});