import { Op } from './operators.js';

/**
 * Generador de consultas SQL para Firebird.
 */
export class QueryGenerator {
  constructor(dialect) {
    this.dialect = dialect;
  }

  insertQuery(model, data) {
    const keys = Object.keys(data);
    const sql = `INSERT INTO ${model.tableName} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    return { sql, params: Object.values(data) };
  }

  updateQuery(model, data, options) {
    const keys = Object.keys(data);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const where = this.parseWhere(options.where);
    const sql = `UPDATE ${model.tableName} SET ${setClause} WHERE ${where.sql}`;
    return { sql, params: [...Object.values(data), ...where.params] };
  }

  deleteQuery(model, options) {
    const where = this.parseWhere(options.where);
    const sql = `DELETE FROM ${model.tableName} WHERE ${where.sql}`;
    return { sql, params: where.params };
  }

  selectQuery(model, options = {}) {
    // 1. SELECT columnas base
    const columns = [
      ...Object.keys(model.attributes).map(key => `${model.tableName}.${key} AS "${model.tableName}.${key}"`)
    ];

    // 2. JOINs (y columnas de JOINs)
    let joins = '';
    if (options.include) {
      options.include.forEach(targetModel => {
        const association = model.associations[targetModel.name];
        if (association) {
          const targetTable = targetModel.tableName;
          // Añadir columnas relacionadas
          columns.push(...Object.keys(targetModel.attributes).map(key => `${targetTable}.${key} AS "${targetTable}.${key}"`));
          joins += ` LEFT JOIN ${targetTable} ON ${model.tableName}.id = ${targetTable}.${association.foreignKey}`;
        }
      });
    }

    // 3. Construcción final
    let sql = `SELECT ${columns.join(', ')} FROM ${model.tableName}${joins}`;
    let params = [];

    // 4. WHERE
    if (options.where) {
      const where = this.parseWhere(options.where);
      sql += ` WHERE ${where.sql}`;
      params = where.params;
    }
    return { sql, params };
  }

  parseWhere(where) {
    const params = [];
    const clauses = Object.keys(where).map(key => {
      const value = where[key];

      // Manejo de operadores lógicos (AND/OR) - Usamos Op.and/Op.or que son 'AND'/'OR'
      if (key === Op.and || key === Op.or) {
        const op = key === Op.and ? ' AND ' : ' OR ';
        const sub = value.map(v => this.parseWhere(v));
        params.push(...sub.flatMap(s => s.params));
        return `(${sub.map(s => s.sql).join(op)})`;
      }

      // Manejo de comparación simple
      if (typeof value !== 'object' || value === null) {
        params.push(value);
        return `${key} = ?`;
      }

      // Manejo de operadores complejos
      // opKey ya es el string SQL (ej: 'LIKE', 'IN', 'BETWEEN') porque Op.like === 'LIKE'
      const opKey = Object.keys(value)[0];
      const opValue = value[opKey];

      if (opKey === 'IN' || opKey === 'NOT IN') {
        params.push(...opValue);
        const placeholders = opValue.map(() => '?').join(', ');
        return `${key} ${opKey} (${placeholders})`;
      }
      if (opKey === 'BETWEEN' || opKey === 'NOT BETWEEN') {
        params.push(opValue[0], opValue[1]);
        return `${key} ${opKey} ? AND ?`;
      }

      params.push(opValue);
      return `${key} ${opKey} ?`;
    });

    return { sql: clauses.join(' AND '), params };
  }
}