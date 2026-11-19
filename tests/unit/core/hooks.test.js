import { Sequelize } from '../../../src/index.js';
import { DataTypes } from '../../../src/core/data-types.js';

describe('Hooks (Fase 5)', () => {
  const sequelize = new Sequelize({});

  test('Debe disparar hooks beforeCreate y afterCreate', async () => {
    const beforeCreateSpy = jest.fn();
    const afterCreateSpy = jest.fn();

    const User = sequelize.define('User', {
      username: DataTypes.STRING(50)
    }, {
      hooks: {
        beforeCreate: beforeCreateSpy,
        afterCreate: afterCreateSpy
      }
    });

    // Mock de sequelize.query para no intentar ejecutar SQL real
    sequelize.query = jest.fn().mockResolvedValue([]);

    await User.create({ username: 'pisco' });

    expect(beforeCreateSpy).toHaveBeenCalledWith({ username: 'pisco' }, {});
    expect(afterCreateSpy).toHaveBeenCalled();
  });

  test('Debe disparar hooks beforeUpdate y afterUpdate', async () => {
    const beforeUpdateSpy = jest.fn();
    const afterUpdateSpy = jest.fn();

    const User = sequelize.define('User', {
      username: DataTypes.STRING(50)
    }, {
      hooks: {
        beforeUpdate: beforeUpdateSpy,
        afterUpdate: afterUpdateSpy
      }
    });

    sequelize.query = jest.fn().mockResolvedValue([]);

    await User.update({ username: 'claude' }, { where: { id: 1 } });

    expect(beforeUpdateSpy).toHaveBeenCalledWith({ username: 'claude' }, { where: { id: 1 } });
    expect(afterUpdateSpy).toHaveBeenCalledWith({ username: 'claude' }, { where: { id: 1 } });
  });

  test('Debe disparar hooks beforeDestroy y afterDestroy', async () => {
    const beforeDestroySpy = jest.fn();
    const afterDestroySpy = jest.fn();

    const User = sequelize.define('User', {
      username: DataTypes.STRING(50)
    }, {
      hooks: {
        beforeDestroy: beforeDestroySpy,
        afterDestroy: afterDestroySpy
      }
    });

    sequelize.query = jest.fn().mockResolvedValue([]);

    await User.destroy({ where: { id: 1 } });

    // triggerHook pasa (instanceOrValues, options) - options es {} por defecto
    expect(beforeDestroySpy).toHaveBeenCalledWith({ where: { id: 1 } }, {});
    expect(afterDestroySpy).toHaveBeenCalledWith({ where: { id: 1 } }, {});
  });
});
