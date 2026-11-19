/**
 * Utilidades para escapar SQL de forma segura en Firebird.
 *
 * REGLAS DE ORO:
 * - VALORES (WHERE id = ?): NUNCA uses esto. Usa 'replacements' en queryRaw.
 * - IDENTIFICADORES (tablas/columnas): USA SqlEscape.ident().
 *
 * @example
 * import { SqlEscape } from 'firebird-orm';
 *
 * const sql = `SELECT * FROM ${SqlEscape.ident('users')} WHERE ${SqlEscape.ident('name')} = ?`;
 * await sequelize.queryRaw(sql, { replacements: ['Pisco'] });
 */

export class SqlEscape {
  /**
   * Escapa un identificador (nombre de tabla, columna, índice, alias).
   * Firebird usa comillas dobles para identificadores "Case Sensitive".
   * Convierte comillas dobles internas en dobles comillas dobles (estándar SQL).
   *
   * @param {string|string[]} name - Nombre o array de partes (ej: ['schema', 'tabla'])
   * @returns {string} Identificador escapado y listo para interpolar en template string.
   */
  static ident(name) {
    if (Array.isArray(name)) {
      return name.map(n => this.ident(n)).join('.');
    }
    if (typeof name !== 'string') {
      throw new Error('SqlEscape.ident espera un string o array de strings');
    }
    // Escapar comillas dobles internas: Mi"Tabla -> "Mi""Tabla"
    return `"${name.replace(/"/g, '""')}"`;
  }

  /**
   * Escapa un valor literal para usarlo directamente en SQL (SOLO DDL/Debug).
   *
   * @param {*} value - Valor a escapar (string, number, boolean, null, Date)
   * @returns {string} Literal SQL escapado.
   *
   * @warning NO USAR EN queryRaw para valores de WHERE/INSERT/UPDATE.
   * Usa placeholders (?) y el objeto { replacements: [...] }.
   * Esto es solo para: CREATE TABLE, debugging, o SQL estático que no acepte parámetros.
   */
  static val(value) {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date) {
      // Formato Firebird TIMESTAMP: 'YYYY-MM-DD HH:MM:SS.mmm'
      const pad = (n) => n.toString().padStart(2, '0');
      const ms = value.getMilliseconds().toString().padStart(3, '0');
      return `'${value.getFullYear()}-${pad(value.getMonth()+1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${ms}'`;
    }
    if (typeof value === 'string') {
      // Escapar comillas simples: O'Reilly -> O''Reilly
      return `'${value.replace(/'/g, "''")}'`;
    }
    throw new Error(`Tipo no soportado para SqlEscape.val: ${typeof value}`);
  }
}