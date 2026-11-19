import { QueryGenerator } from '../../../src/query/query-generator.js';
import { Op } from '../../../src/query/operators.js';
import { fn, col, literal, cast } from '../../../src/query/functions.js';
import { HasMany } from '../../../src/core/associations/has-many.js';
import { BelongsTo } from '../../../src/core/associations/belongs-to.js';

/**
 * Mock Dialect para controlar features según versión Firebird
 */
function createMockDialect(features = {}) {
  return {
    supports: (feature) => features[feature] ?? true,
    versionParts: features.versionParts || [3, 0],
  };
}

/**
 * Mock Model para tests con asociaciones reales
 */
function createMockModel(overrides = {}) {
  // 1. Definir objetos primero
  const Post = {
    tableName: 'posts',
    attributes: { id: {}, user_id: {}, title: {}, content: {} },
    name: 'Post',
    associations: {}
  };

  const User = {
    tableName: 'users',
    attributes: { id: {}, name: {}, email: {}, age: {}, active: {} },
    name: 'User',
    associations: {}
  };

  // 2. Asignar asociaciones después, cuando ya existen
  User.associations = {
    posts: new HasMany(User, Post, { foreignKey: 'user_id' }),
    Post: new BelongsTo(User, Post, { foreignKey: 'user_id' }),
  };

  return { ...User, ...overrides };
}

describe('QueryGenerator', () => {
  let dialect;
  let generator;
  let model;

  beforeEach(() => {
    dialect = createMockDialect();
    generator = new QueryGenerator(dialect);
    model = createMockModel();
  });

  describe('parseWhere - Operadores básicos', () => {
    test('Igualdad simple: { name: "John" }', () => {
      const result = generator.parseWhere({ name: 'John' });
      expect(result.sql).toBe('name = ?');
      expect(result.params).toEqual(['John']);
    });

    test('Operador Op.eq explícito', () => {
      const result = generator.parseWhere({ name: { [Op.eq]: 'John' } });
      expect(result.sql).toBe('name = ?');
      expect(result.params).toEqual(['John']);
    });

    test('Desigualdad: { [Op.ne]: "John" }', () => {
      const result = generator.parseWhere({ name: { [Op.ne]: 'John' } });
      expect(result.sql).toBe('name <> ?');
      expect(result.params).toEqual(['John']);
    });

    test('Mayor que: { [Op.gt]: 18 }', () => {
      const result = generator.parseWhere({ age: { [Op.gt]: 18 } });
      expect(result.sql).toBe('age > ?');
      expect(result.params).toEqual([18]);
    });

    test('Mayor o igual: { [Op.gte]: 18 }', () => {
      const result = generator.parseWhere({ age: { [Op.gte]: 18 } });
      expect(result.sql).toBe('age >= ?');
      expect(result.params).toEqual([18]);
    });

    test('Menor que: { [Op.lt]: 65 }', () => {
      const result = generator.parseWhere({ age: { [Op.lt]: 65 } });
      expect(result.sql).toBe('age < ?');
      expect(result.params).toEqual([65]);
    });

    test('Menor o igual: { [Op.lte]: 65 }', () => {
      const result = generator.parseWhere({ age: { [Op.lte]: 65 } });
      expect(result.sql).toBe('age <= ?');
      expect(result.params).toEqual([65]);
    });

    test('LIKE: { [Op.like]: "J%" }', () => {
      const result = generator.parseWhere({ name: { [Op.like]: 'J%' } });
      expect(result.sql).toBe('name LIKE ?');
      expect(result.params).toEqual(['J%']);
    });

    test('NOT LIKE: { [Op.notLike]: "%spam%" }', () => {
      const result = generator.parseWhere({ email: { [Op.notLike]: '%spam%' } });
      expect(result.sql).toBe('email NOT LIKE ?');
      expect(result.params).toEqual(['%spam%']);
    });

    test('IN array: { [Op.in]: [1,2,3] }', () => {
      const result = generator.parseWhere({ id: { [Op.in]: [1, 2, 3] } });
      expect(result.sql).toBe('id IN (?, ?, ?)');
      expect(result.params).toEqual([1, 2, 3]);
    });

    test('NOT IN array: { [Op.notIn]: [1,2,3] }', () => {
      const result = generator.parseWhere({ id: { [Op.notIn]: [1, 2, 3] } });
      expect(result.sql).toBe('id NOT IN (?, ?, ?)');
      expect(result.params).toEqual([1, 2, 3]);
    });

    test('BETWEEN: { [Op.between]: [10, 20] }', () => {
      const result = generator.parseWhere({ age: { [Op.between]: [10, 20] } });
      expect(result.sql).toBe('age BETWEEN ? AND ?');
      expect(result.params).toEqual([10, 20]);
    });

    test('NOT BETWEEN: { [Op.notBetween]: [10, 20] }', () => {
      const result = generator.parseWhere({ age: { [Op.notBetween]: [10, 20] } });
      expect(result.sql).toBe('age NOT BETWEEN ? AND ?');
      expect(result.params).toEqual([10, 20]);
    });

    test('IS NULL: { [Op.is]: null }', () => {
      const result = generator.parseWhere({ email: { [Op.is]: null } });
      expect(result.sql).toBe('email IS NULL');
      expect(result.params).toEqual([]);
    });

    test('Igualdad con null se convierte en IS NULL', () => {
      const result = generator.parseWhere({ email: null });
      expect(result.sql).toBe('email IS NULL');
      expect(result.params).toEqual([]);
    });

    test('Desigualdad con null se convierte en IS NOT NULL', () => {
      const result = generator.parseWhere({ email: { [Op.ne]: null } });
      expect(result.sql).toBe('email IS NOT NULL');
      expect(result.params).toEqual([]);
    });
  });

  describe('parseWhere - Operadores lógicos', () => {
    test('AND explícito: { [Op.and]: [{name: "A"}, {name: "B"}] }', () => {
      const result = generator.parseWhere({
        [Op.and]: [{ name: 'A' }, { name: 'B' }]
      });
      expect(result.sql).toBe('(name = ? AND name = ?)');
      expect(result.params).toEqual(['A', 'B']);
    });

    test('OR explícito: { [Op.or]: [{name: "A"}, {name: "B"}] }', () => {
      const result = generator.parseWhere({
        [Op.or]: [{ name: 'A' }, { name: 'B' }]
      });
      expect(result.sql).toBe('(name = ? OR name = ?)');
      expect(result.params).toEqual(['A', 'B']);
    });

    test('Combinación AND/OR anidados', () => {
      const result = generator.parseWhere({
        [Op.or]: [
          { name: 'Admin' },
          { [Op.and]: [{ role: 'User' }, { active: 1 }] }
        ]
      });
      expect(result.sql).toBe('(name = ? OR (role = ? AND active = ?))');
      expect(result.params).toEqual(['Admin', 'User', 1]);
    });

    test('Múltiples condiciones en objeto raíz = AND implícito', () => {
      const result = generator.parseWhere({ name: 'John', active: 1 });
      expect(result.sql).toBe('name = ? AND active = ?');
      expect(result.params).toEqual(['John', 1]);
    });
  });

  describe('parseWhere - Expresiones especiales (fn, col, literal, cast)', () => {
    test('fn() en where: where: { age: fn("UPPER", col("name")) }', () => {
      const result = generator.parseWhere({ age: fn('UPPER', col('name')) });
      expect(result.sql).toBe('age = UPPER("name")');
      expect(result.params).toEqual([]);
    });

    test('col() en where', () => {
      const result = generator.parseWhere({ name: col('other_table.name') });
      expect(result.sql).toBe('name = "other_table"."name"');
      expect(result.params).toEqual([]);
    });

    test('literal() en where', () => {
      const result = generator.parseWhere({ created_at: literal('CURRENT_TIMESTAMP') });
      expect(result.sql).toBe('created_at = CURRENT_TIMESTAMP');
      expect(result.params).toEqual([]);
    });

    test('cast() en where', () => {
      const result = generator.parseWhere({ value: cast(col('raw_value'), 'INTEGER') });
      expect(result.sql).toBe('value = CAST("raw_value" AS INTEGER)');
      expect(result.params).toEqual([]);
    });
  });

  describe('selectQuery - Básico', () => {
    test('SELECT * simple', () => {
      const result = generator.selectQuery(model, {});
      expect(result.sql).toContain('SELECT');
      expect(result.sql).toContain('FROM users');
      expect(result.params).toEqual([]);
    });

    test('SELECT con attributes específicos', () => {
      const result = generator.selectQuery(model, { attributes: ['id', 'name'] });
      expect(result.sql).toContain('id AS "users.id"');
      expect(result.sql).toContain('name AS "users.name"');
    });

    test('SELECT con alias en attributes: [["col", "alias"]]', () => {
      const result = generator.selectQuery(model, { attributes: [['name', 'full_name']] });
      expect(result.sql).toContain('name AS "full_name"');
    });

    test('SELECT con fn en attributes', () => {
      const result = generator.selectQuery(model, { attributes: [fn('COUNT', col('id'))] });
      expect(result.sql).toContain('COUNT("id")');
    });

    test('SELECT con col en attributes', () => {
      const result = generator.selectQuery(model, { attributes: [col('other_table.name')] });
      expect(result.sql).toContain('"other_table"."name"');
    });
  });

  describe('selectQuery - WHERE', () => {
    test('WHERE simple integrado', () => {
      const result = generator.selectQuery(model, { where: { name: 'John' } });
      expect(result.sql).toContain('WHERE name = ?');
      expect(result.params).toEqual(['John']);
    });

    test('WHERE con operadores', () => {
      const result = generator.selectQuery(model, { where: { age: { [Op.gt]: 18 } } });
      expect(result.sql).toContain('WHERE age > ?');
      expect(result.params).toEqual([18]);
    });
  });

  describe('selectQuery - ORDER BY', () => {
    test('ORDER BY simple', () => {
      const result = generator.selectQuery(model, { order: [['name', 'ASC']] });
      expect(result.sql).toContain('ORDER BY users.name ASC');
    });

    test('ORDER BY multiple', () => {
      const result = generator.selectQuery(model, { order: [['name', 'ASC'], ['age', 'DESC']] });
      expect(result.sql).toContain('ORDER BY users.name ASC, users.age DESC');
    });

    test('ORDER BY con tabla explícita', () => {
      const result = generator.selectQuery(model, { order: [[model.tableName, 'name', 'DESC']] });
      expect(result.sql).toContain('ORDER BY users.name DESC');
    });
  });

  describe('selectQuery - Paginación (FB 3.0+ por defecto)', () => {
    test('LIMIT simple', () => {
      const result = generator.selectQuery(model, { limit: 10 });
      expect(result.sql).toContain('LIMIT ?');
      expect(result.params).toEqual([10]);
    });

    test('OFFSET simple', () => {
      const result = generator.selectQuery(model, { offset: 20 });
      expect(result.sql).toContain('OFFSET ?');
      expect(result.params).toEqual([20]);
    });

    test('LIMIT + OFFSET', () => {
      const result = generator.selectQuery(model, { limit: 10, offset: 20 });
      expect(result.sql).toContain('LIMIT ? OFFSET ?');
      expect(result.params).toEqual([10, 20]);
    });
  });

  describe('selectQuery - Paginación Firebird 2.5 (FIRST/SKIP/ROWS)', () => {
    beforeEach(() => {
      dialect = createMockDialect({ limit_offset: false, versionParts: [2, 5] });
      generator = new QueryGenerator(dialect);
      model = createMockModel();
    });

    test('LIMIT en FB 2.5 usa FIRST', () => {
      const result = generator.selectQuery(model, { limit: 10 });
      expect(result.sql).toContain('FIRST ?');
      expect(result.params).toEqual([10]);
    });

    test('OFFSET en FB 2.5 usa SKIP', () => {
      const result = generator.selectQuery(model, { offset: 20 });
      expect(result.sql).toContain('SKIP ?');
      expect(result.params).toEqual([20]);
    });

    test('LIMIT + OFFSET en FB 2.5 usa ROWS ... TO ...', () => {
      const result = generator.selectQuery(model, { limit: 10, offset: 20 });
      expect(result.sql).toContain('ROWS ? TO ?');
      // ROWS 21 TO 30 (1-based)
      expect(result.params).toEqual([21, 30]);
    });
  });

  describe('selectQuery - JOINs (include)', () => {
    test('LEFT JOIN básico con include (HasMany)', () => {
      const result = generator.selectQuery(model, {
        include: [{ model: model.associations.posts.targetModel, as: 'posts' }]
      });
      expect(result.sql).toContain('LEFT JOIN posts');
      expect(result.sql).toContain('ON users.id = posts.user_id');
    });

    test('INNER JOIN con required: true', () => {
      const result = generator.selectQuery(model, {
        include: [{ model: model.associations.posts.targetModel, as: 'posts', required: true }]
      });
      expect(result.sql).toContain('INNER JOIN posts');
    });

    test('Columnas de JOIN incluidas en SELECT', () => {
      const result = generator.selectQuery(model, {
        include: [{ model: model.associations.posts.targetModel, as: 'posts' }]
      });
      expect(result.sql).toContain('posts.id AS "posts.id"');
      expect(result.sql).toContain('posts.title AS "posts.title"');
    });

    test('Attributes específicos en include', () => {
      const result = generator.selectQuery(model, {
        include: [{ model: model.associations.posts.targetModel, as: 'posts', attributes: ['title'] }]
      });
      expect(result.sql).toContain('posts.title AS "posts.title"');
      expect(result.sql).not.toContain('posts.content');
    });

    test('BelongsTo JOIN (FK en source)', () => {
      const result = generator.selectQuery(model, {
        include: [{ model: model.associations.Post.targetModel, as: 'Post' }]
      });
      expect(result.sql).toContain('LEFT JOIN posts');
      expect(result.sql).toContain('ON posts.id = users.user_id');
    });
  });

  describe('countQuery', () => {
    test('COUNT(*) simple', () => {
      const result = generator.countQuery(model, {});
      expect(result.sql).toBe('SELECT COUNT(*) FROM users');
      expect(result.params).toEqual([]);
    });

    test('COUNT con WHERE', () => {
      const result = generator.countQuery(model, { where: { active: 1 } });
      expect(result.sql).toContain('WHERE active = ?');
      expect(result.params).toEqual([1]);
    });

    test('COUNT con JOINs', () => {
      const result = generator.countQuery(model, {
        include: [{ model: model.associations.posts.targetModel, as: 'posts' }]
      });
      expect(result.sql).toContain('LEFT JOIN posts');
    });
  });

  describe('insertQuery / updateQuery / deleteQuery', () => {
    test('insertQuery genera SQL parametrizado', () => {
      const result = generator.insertQuery(model, { name: 'John', email: 'john@test.com' });
      expect(result.sql).toBe('INSERT INTO users (name, email) VALUES (?, ?)');
      expect(result.params).toEqual(['John', 'john@test.com']);
    });

    test('updateQuery con WHERE', () => {
      const result = generator.updateQuery(model, { name: 'Jane' }, { where: { id: 1 } });
      expect(result.sql).toBe('UPDATE users SET name = ? WHERE id = ?');
      expect(result.params).toEqual(['Jane', 1]);
    });

    test('deleteQuery con WHERE', () => {
      const result = generator.deleteQuery(model, { where: { id: 1 } });
      expect(result.sql).toBe('DELETE FROM users WHERE id = ?');
      expect(result.params).toEqual([1]);
    });
  });
});