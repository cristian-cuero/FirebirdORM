import { Sequelize } from '../../src/index.js';
import { DataTypes } from '../../src/core/data-types.js';
import { HasMany } from '../../src/core/associations/has-many.js';

describe('Verification Phase 4 - Associations', () => {
  const sequelize = new Sequelize({});

  test('Debe registrar correctamente una relación HasMany', () => {
    // 1. Definir dos modelos
    const User = sequelize.define('User', { name: DataTypes.STRING() });
    const Post = sequelize.define('Post', { title: DataTypes.STRING() });

    // 2. Definir la relación
    User.hasMany(Post, { foreignKey: 'userId' });

    // 3. Verificar que la asociación quedó registrada
    expect(User.associations['Post']).toBeDefined();
    expect(User.associations['Post']).toBeInstanceOf(HasMany);
    expect(User.associations['Post'].foreignKey).toBe('userId');
  });

  test('Debe usar una clave foránea por defecto si no se especifica', () => {
    const Author = sequelize.define('Author', { name: DataTypes.STRING() });
    const Book = sequelize.define('Book', { title: DataTypes.STRING() });

    Author.hasMany(Book); // FK por defecto debería ser 'authorId'

    expect(Author.associations['Book'].foreignKey).toBe('authorId');
  });
});
