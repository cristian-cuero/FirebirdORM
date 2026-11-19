import { Op } from './operators.js';
import { Fn, Col, Literal, Cast } from './functions.js';

/**
 * Generador de consultas SQL para Firebird.
 * Adapta SQL según versión detectada (Dialect).
 */
export class QueryGenerator {
  constructor(dialect) {
    this.dialect = dialect;
  }

  /**
   * INSERT query
   */
  insertQuery(model, data) {
    const keys = Object.keys(data);
    const sql = `INSERT INTO ${model.tableName} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    return { sql, params: Object.values(data) };
  }

  /**
   * UPDATE query
   */
  updateQuery(model, data, options) {
    const keys = Object.keys(data);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const where = this.parseWhere(options.where);
    const sql = `UPDATE ${model.tableName} SET ${setClause} WHERE ${where.sql}`;
    return { sql, params: [...Object.values(data), ...where.params] };
  }

  /**
   * DELETE query
   */
  deleteQuery(model, options) {
    const where = this.parseWhere(options.where);
    const sql = `DELETE FROM ${model.tableName} WHERE ${where.sql}`;
    return { sql, params: where.params };
  }

  /**
   * SELECT query con soporte para:
   * - columns explícitas
   * - where con operadores (Op)
   * - include (JOINs básicos)
   * - order
   * - limit/offset (paginación adaptada a versión FB)
   */
  selectQuery(model, options = {}) {
    // 1. Columnas a seleccionar
    let columns = options.attributes
      ? options.attributes.map(attr => this._formatAttribute(attr, model.tableName))
      : Object.keys(model.attributes).map(key => `${model.tableName}.${key} AS "${model.tableName}.${key}"`);

    // 2. JOINs (include)
    let joins = '';
    if (options.include) {
      const { joinSql, joinColumns } = this._buildJoins(model, options.include);
      joins = joinSql;
      columns = [...columns, ...joinColumns];
    }

    // 3. WHERE
    const where = this.parseWhere(options.where);
    const whereClause = where.sql ? ` WHERE ${where.sql}` : '';

    // 4. ORDER BY
    const orderClause = this._buildOrderClause(model, options.order);

    // 5. LIMIT/OFFSET (paginación)
    const pagination = this._buildPagination(options.limit, options.offset);

    // 6. Construcción final
    let sql = `SELECT ${columns.join(', ')} FROM ${model.tableName}${joins}${whereClause}${orderClause}${pagination.sql}`;

    return { sql, params: [...where.params, ...pagination.params] };
  }

  /**
   * Construye cláusula ORDER BY
   * Acepta formatos: [['field', 'ASC']], [['table', 'field', 'ASC']], ['field']
   */
  _buildOrderClause(model, order) {
    if (!order || !order.length) return '';

    const orderParts = order.map(item => {
      // Si es array de 3 elementos: [table, field, direction]
      if (Array.isArray(item) && item.length === 3) {
        const [table, field, direction] = item;
        const dir = direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        return `${table}.${field} ${dir}`;
      }
      // Si es array de 2 elementos: [field, direction] o [table, field]
      if (Array.isArray(item) && item.length === 2) {
        const [field, direction] = item;
        const dir = direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        // Si field contiene un punto, asumimos que es "table.field"
        if (field.includes('.')) {
          return `${field} ${dir}`;
        }
        return `${model.tableName}.${field} ${dir}`;
      }
      // String simple: 'field' o 'table.field'
      if (typeof item === 'string') {
        if (item.includes('.')) {
          return `${item} ASC`;
        }
        return `${model.tableName}.${item} ASC`;
      }
      return '';
    }).filter(Boolean);

    return orderParts.length ? ` ORDER BY ${orderParts.join(', ')}` : '';
  }

  /**
   * Parsea objeto where a SQL + params
   * Soporta operadores de Op, nesting AND/OR, y valores especiales (null, arrays)
   */
  parseWhere(where) {
    if (!where || Object.keys(where).length === 0) {
      return { sql: '', params: [] };
    }

    const conditions = [];
    const params = [];

    for (const [key, value] of Object.entries(where)) {
      // Operadores lógicos especiales
      if (key === Op.and || key === '$and') {
        const subConditions = value.map(w => this.parseWhere(w));
        conditions.push(`(${subConditions.map(c => c.sql).filter(s => s).join(' AND ')})`);
        subConditions.forEach(c => params.push(...c.params));
        continue;
      }
      if (key === Op.or || key === '$or') {
        const subConditions = value.map(w => this.parseWhere(w));
        conditions.push(`(${subConditions.map(c => c.sql).filter(s => s).join(' OR ')})`);
        subConditions.forEach(c => params.push(...c.params));
        continue;
      }

      // Campo normal con posible operador
      const condition = this._parseCondition(key, value);
      if (condition.sql) {
        conditions.push(condition.sql);
        params.push(...condition.params);
      }
    }

    return { sql: conditions.join(' AND '), params };
  }

  /**
   * Parsea una condición individual: campo -> valor/operador
   */
  _parseCondition(field, value) {
    // Si el valor es un objeto con operadores: { [Op.gt]: 10, [Op.lt]: 20 }
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Fn) && !(value instanceof Col) && !(value instanceof Literal) && !(value instanceof Cast)) {
      const ops = [];
      const opParams = [];

      for (const [op, opValue] of Object.entries(value)) {
        const parsed = this._parseOperator(field, op, opValue);
        if (parsed.sql) {
          ops.push(parsed.sql);
          opParams.push(...parsed.params);
        }
      }

      return { sql: ops.join(' AND '), params: opParams };
    }

    // Valor simple (igualdad)
    return this._parseOperator(field, Op.eq, value);
  }

  /**
   * Parsea un operador específico
   */
  _parseOperator(field, operator, value) {
    const params = [];

    // Manejar Fn, Col, Literal, Cast como valores
    const isSpecial = value instanceof Fn || value instanceof Col || value instanceof Literal || value instanceof Cast;

    switch (operator) {
      case Op.eq:
      case '=':
        if (value === null) return { sql: `${field} IS NULL`, params: [] };
        if (isSpecial) return { sql: `${field} = ${value.toSQL(this.dialect)}`, params: value.getParams() };
        return { sql: `${field} = ?`, params: [value] };

      case Op.ne:
      case '<>':
        if (value === null) return { sql: `${field} IS NOT NULL`, params: [] };
        if (isSpecial) return { sql: `${field} <> ${value.toSQL(this.dialect)}`, params: value.getParams() };
        return { sql: `${field} <> ?`, params: [value] };

      case Op.gt:
      case '>':
        if (isSpecial) return { sql: `${field} > ${value.toSQL(this.dialect)}`, params: value.getParams() };
        return { sql: `${field} > ?`, params: [value] };

      case Op.gte:
      case '>=':
        if (isSpecial) return { sql: `${field} >= ${value.toSQL(this.dialect)}`, params: value.getParams() };
        return { sql: `${field} >= ?`, params: [value] };

      case Op.lt:
      case '<':
        if (isSpecial) return { sql: `${field} < ${value.toSQL(this.dialect)}`, params: value.getParams() };
        return { sql: `${field} < ?`, params: [value] };

      case Op.lte:
      case '<=':
        if (isSpecial) return { sql: `${field} <= ${value.toSQL(this.dialect)}`, params: value.getParams() };
        return { sql: `${field} <= ?`, params: [value] };

      case Op.like:
        if (isSpecial) return { sql: `${field} LIKE ${value.toSQL(this.dialect)}`, params: value.getParams() };
        return { sql: `${field} LIKE ?`, params: [value] };

      case Op.notLike:
        if (isSpecial) return { sql: `${field} NOT LIKE ${value.toSQL(this.dialect)}`, params: value.getParams() };
        return { sql: `${field} NOT LIKE ?`, params: [value] };

      case Op.in:
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          return { sql: `${field} IN (${placeholders})`, params: value };
        }
        return { sql: '1=0', params: [] }; // IN vacío = false

      case Op.notIn:
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          return { sql: `${field} NOT IN (${placeholders})`, params: value };
        }
        return { sql: '1=1', params: [] }; // NOT IN vacío = true

      case Op.between:
        if (Array.isArray(value) && value.length === 2) {
          if (isSpecial) {
            // No soportado fácilmente, fallback
          }
          return { sql: `${field} BETWEEN ? AND ?`, params: value };
        }
        return { sql: '1=0', params: [] };

      case Op.notBetween:
        if (Array.isArray(value) && value.length === 2) {
          return { sql: `${field} NOT BETWEEN ? AND ?`, params: value };
        }
        return { sql: '1=1', params: [] };

      case Op.is:
        if (value === null) return { sql: `${field} IS NULL`, params: [] };
        return { sql: `${field} IS ?`, params: [value] };

      default:
        // Operador desconocido: tratar como igualdad
        if (isSpecial) return { sql: `${field} = ${value.toSQL(this.dialect)}`, params: value.getParams() };
        return { sql: `${field} = ?`, params: [value] };
    }
  }

  /**
   * Construye JOINs desde include usando la metadata de Association
   * Soporta dos formatos:
   *   1. include: [Post] (modelo directo)
   *   2. include: [{ model: Post, as: 'posts', required: true }] (objeto de opciones)
   */
  _buildJoins(model, includes) {
    let joinSql = '';
    const joinColumns = [];

    for (const include of includes) {
      // Soportar formato Sequelize: include puede ser una clase modelo directamente o un objeto { model, as, ... }
      const targetModel = include.model || include;
      const options = include.model ? include : {};

      // Buscar la asociación por el alias (options.as) o por nombre del modelo
      const alias = options.as || targetModel.name;
      const association = model.associations?.[alias];

      if (!association) {
        // Fallback: si no hay asociación definida, asumir HasMany por compatibilidad
        const targetTable = targetModel.tableName;
        const foreignKey = `${model.name.toLowerCase()}Id`;
        const joinType = options.required ? 'INNER JOIN' : 'LEFT JOIN';
        joinSql += ` ${joinType} ${targetTable} ON ${model.tableName}.id = ${targetTable}.${foreignKey}`;

        const attrs = options.attributes || Object.keys(targetModel.attributes);
        for (const attr of attrs) {
          joinColumns.push(`${targetTable}.${attr} AS "${targetTable}.${attr}"`);
        }
      } else {
        // Usar la lógica de la Association
        const joinType = options.required ? 'INNER JOIN' : (association.joinType || 'LEFT JOIN');
        const joinCondition = association.getJoinCondition();

        joinSql += ` ${joinType} ${targetModel.tableName} ON ${joinCondition}`;

        // Columnas del modelo relacionado
        const attrs = options.attributes || Object.keys(targetModel.attributes);
        for (const attr of attrs) {
          joinColumns.push(`${targetModel.tableName}.${attr} AS "${targetModel.tableName}.${attr}"`);
        }
      }

      // Nested includes
      if (options.include) {
        const nested = this._buildJoins(targetModel, options.include);
        joinSql += nested.joinSql;
        joinColumns.push(...nested.joinColumns);
      }
    }

    return { joinSql, joinColumns };
  }

  /**
   * Formatea atributo para SELECT (maneja fn, col, literal, cast, alias)
   */
  _formatAttribute(attr, defaultTable) {
    if (attr instanceof Fn) return `${attr.toSQL(this.dialect)}`;
    if (attr instanceof Col) return `${attr.toSQL(this.dialect)}`;
    if (attr instanceof Literal) return `${attr.toSQL(this.dialect)}`;
    if (attr instanceof Cast) return `${attr.toSQL(this.dialect)}`;

    // Array [expression, alias]
    if (Array.isArray(attr)) {
      const [expr, alias] = attr;
      if (expr instanceof Fn) return `${expr.toSQL(this.dialect)} AS "${alias}"`;
      if (expr instanceof Col) return `${expr.toSQL(this.dialect)} AS "${alias}"`;
      if (expr instanceof Literal) return `${expr.toSQL(this.dialect)} AS "${alias}"`;
      if (expr instanceof Cast) return `${expr.toSQL(this.dialect)} AS "${alias}"`;
      return `${defaultTable}.${expr} AS "${alias}"`;
    }

    return `${defaultTable}.${attr} AS "${defaultTable}.${attr}"`;
  }

  /**
   * Construye cláusula de paginación según versión Firebird
   * FB 2.5: FIRST n SKIP m
   * FB 3.0+: LIMIT n OFFSET m (o ROWS m TO n)
   */
  _buildPagination(limit, offset) {
    const params = [];

    if (!limit && !offset) return { sql: '', params: [] };

    const supportsLimit = this.dialect?.supports?.('limit_offset') ?? true; // FB 3.0+

    if (supportsLimit) {
      // Firebird 3.0+ soporta LIMIT/OFFSET
      let sql = '';
      if (limit) {
        sql += ` LIMIT ?`;
        params.push(limit);
      }
      if (offset) {
        sql += ` OFFSET ?`;
        params.push(offset);
      }
      return { sql, params };
    } else {
      // Firebird 2.5: FIRST / SKIP
      let sql = '';
      if (limit && offset) {
        sql += ` ROWS ? TO ?`;
        params.push(offset + 1, offset + limit);
      } else if (limit) {
        sql += ` FIRST ?`;
        params.push(limit);
      } else if (offset) {
        sql += ` SKIP ?`;
        params.push(offset);
      }
      return { sql, params };
    }
  }

  /**
   * SELECT COUNT(*)
   */
  countQuery(model, options = {}) {
    const where = this.parseWhere(options.where);
    const joins = options.include ? this._buildJoins(model, options.include).joinSql : '';
    const sql = `SELECT COUNT(*) FROM ${model.tableName}${joins}${where.sql ? ` WHERE ${where.sql}` : ''}`;
    return { sql, params: where.params };
  }
}