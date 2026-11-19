/**
 * Utilidades SQL para consultas avanzadas (fn, col, literal, cast)
 * Inspirado en Sequelize, adaptado a Firebird
 */

/**
 * Representa una función SQL (ej: fn('UPPER', col('name')))
 */
export class Fn {
  constructor(name, args = []) {
    this.name = name;
    this.args = args;
  }

  toSQL(dialect) {
    const formattedArgs = this.args.map(arg => {
      if (arg instanceof Fn) return arg.toSQL(dialect);
      if (arg instanceof Col) return arg.toSQL(dialect);
      if (arg instanceof Literal) return arg.toSQL(dialect);
      if (arg instanceof Cast) return arg.toSQL(dialect);
      // Valor literal: parametrizar
      return '?';
    });
    return `${this.name}(${formattedArgs.join(', ')})`;
  }

  getParams() {
    const params = [];
    for (const arg of this.args) {
      if (arg instanceof Fn) params.push(...arg.getParams());
      else if (arg instanceof Col) { /* columns don't add params */ }
      else if (arg instanceof Literal) { /* literals don't add params */ }
      else if (arg instanceof Cast) params.push(...arg.getParams());
      else params.push(arg);
    }
    return params;
  }
}

/**
 * Representa una columna (ej: col('name'), col('user.name'))
 */
export class Col {
  constructor(name) {
    this.name = name;
  }

  toSQL(dialect) {
    // Si contiene punto, asumimos que es "tabla.columna"
    if (this.name.includes('.')) {
      const [table, column] = this.name.split('.');
      return `"${table}"."${column}"`;
    }
    return `"${this.name}"`;
  }

  getParams() {
    return [];
  }
}

/**
 * Representa SQL literal (ej: literal('CURRENT_TIMESTAMP'))
 * ¡USAR CON CUIDADO! - No parametriza, inyección SQL posible
 */
export class Literal {
  constructor(value) {
    this.value = value;
  }

  toSQL(dialect) {
    return this.value;
  }

  getParams() {
    return [];
  }
}

/**
 * Representa CAST (ej: cast(col('value'), 'INTEGER'))
 */
export class Cast {
  constructor(expr, type) {
    this.expr = expr;
    this.type = type;
  }

  toSQL(dialect) {
    const exprSQL = this.expr instanceof Fn ? this.expr.toSQL(dialect)
      : this.expr instanceof Col ? this.expr.toSQL(dialect)
      : this.expr instanceof Literal ? this.expr.toSQL(dialect)
      : this.expr instanceof Cast ? this.expr.toSQL(dialect)
      : '?';
    return `CAST(${exprSQL} AS ${this.type})`;
  }

  getParams() {
    if (this.expr instanceof Fn) return this.expr.getParams();
    if (this.expr instanceof Cast) return this.expr.getParams();
    // Col, Literal no añaden params
    return [];
  }
}

/**
 * Factory functions (API pública)
 */
export function fn(name, ...args) {
  return new Fn(name, args);
}

export function col(name) {
  return new Col(name);
}

export function literal(value) {
  return new Literal(value);
}

export function cast(expr, type) {
  return new Cast(expr, type);
}