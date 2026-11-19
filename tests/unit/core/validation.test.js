import { Sequelize } from '../../../src/index.js';
import { DataTypes } from '../../../src/core/data-types.js';
import { ValidationError } from '../../../src/core/errors.js';

describe('Validaciones (Fase 5)', () => {
  const sequelize = new Sequelize({});

  test('Debe fallar si un campo allowNull: false es nulo o indefinido', async () => {
    const User = sequelize.define('User', {
      username: { type: DataTypes.STRING(50), allowNull: false }
    });

    const user = new User({ username: null });

    // Debería lanzar error al validar
    expect(() => user.validate()).toThrow(ValidationError);
    expect(() => user.validate()).toThrow(/no puede ser nulo/);
  });

  test('Debe pasar la validación si todos los campos requeridos están presentes', async () => {
    const User = sequelize.define('User', {
      username: { type: DataTypes.STRING(50), allowNull: false }
    });

    const user = new User({ username: 'pisco' });

    expect(() => user.validate()).not.toThrow();
  });
});
