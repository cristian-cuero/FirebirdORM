import { Sequelize } from '../../src/index.js';
import { DataTypes } from '../../src/core/data-types.js';

describe('Integration - Eager Loading (JOINs)', () => {
  const versions = [
    { name: 'Firebird 2.5', port: 3053, db: '/firebird/data/employee.fdb' },
    { name: 'Firebird 3.0', port: 3050, db: '/var/lib/firebird/data/employee.fdb' },
  ];

  for (const version of versions) {
    describe(`Backend: ${version.name}`, () => {
      let sequelize;
      let User;
      let Post;

      beforeAll(async () => {
        sequelize = new Sequelize({
          host: 'localhost',
          port: version.port,
          database: version.db,
          user: 'SYSDBA',
          password: 'masterkey',
        });
        await sequelize.init();

        // Creamos tablas con relación
        await sequelize.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(50))');
        await sequelize.query('CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, title VARCHAR(100))');

        User = sequelize.define('User', { id: DataTypes.INTEGER, name: DataTypes.STRING() }, { tableName: 'users' });
        Post = sequelize.define('Post', { id: DataTypes.INTEGER, user_id: DataTypes.INTEGER, title: DataTypes.STRING() }, { tableName: 'posts' });

        User.hasMany(Post, { foreignKey: 'user_id' });
      });

      afterAll(async () => {
        await sequelize.query('DROP TABLE posts');
        await sequelize.query('DROP TABLE users');
        await sequelize.close();
      });

      test('Debe realizar JOIN automático al usar include', async () => {
        // Insertamos datos usando la instancia sequelize
        await sequelize.query('INSERT INTO users (id, name) VALUES (1, \'Pisco\')');
        await sequelize.query('INSERT INTO posts (id, user_id, title) VALUES (101, 1, \'Hola Mundo\')');

        // Aquí está el reto: Eager Loading
        // El ORM debe hacer el JOIN y devolver el objeto anidado
        const users = await User.findAll({
          include: [Post]
        });

        // Verificamos que trajo el usuario
        expect(users.length).toBe(1);
        expect(users[0].NAME).toBe('Pisco');

        // Verificamos que trajo los posts relacionados
        expect(users[0].posts).toBeDefined();
        expect(users[0].posts[0].title).toBe('Hola Mundo');
      });
    });
  }
});
