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

      beforeAll(async () => {
        sequelize = new Sequelize({
          host: 'localhost',
          port: version.port,
          database: version.db,
          user: 'SYSDBA',
          password: 'masterkey',
        });
        await sequelize.init();
      });

      afterAll(async () => {
        await sequelize.close();
      });

      test('Debe realizar JOIN automático al usar include', async () => {
        const suffix = Date.now();
        const usersTable = `users_${suffix}`;
        const postsTable = `posts_${suffix}`;

        await sequelize.query(`CREATE TABLE ${usersTable} (id INTEGER PRIMARY KEY, name VARCHAR(50))`);
        await sequelize.query(`CREATE TABLE ${postsTable} (id INTEGER PRIMARY KEY, user_id INTEGER, title VARCHAR(100))`);

        const User = sequelize.define('User', { id: DataTypes.INTEGER, name: DataTypes.STRING() }, { tableName: usersTable });
        const Post = sequelize.define('Post', { id: DataTypes.INTEGER, user_id: DataTypes.INTEGER, title: DataTypes.STRING() }, { tableName: postsTable });

        User.hasMany(Post, { foreignKey: 'user_id' });

        await sequelize.query(`INSERT INTO ${usersTable} (id, name) VALUES (1, 'Pisco')`);
        await sequelize.query(`INSERT INTO ${postsTable} (id, user_id, title) VALUES (101, 1, 'Hola Mundo')`);

        const users = await User.findAll({
          include: [Post]
        });

        expect(users.length).toBe(1);
        expect(users[0].NAME).toBe('Pisco');

        expect(users[0].posts).toBeDefined();
        expect(users[0].posts[0].title).toBe('Hola Mundo');

        await sequelize.query(`DROP TABLE ${postsTable}`);
        await sequelize.query(`DROP TABLE ${usersTable}`);
      });
    });
  }
});