import { SqlEscape } from '../../../src/utils/sql-escape.js';

describe('SqlEscape - Utilidades de escape seguro', () => {
  describe('ident()', () => {
    test('Debe escapar identificador simple con comillas dobles', () => {
      expect(SqlEscape.ident('users')).toBe('"users"');
    });

    test('Debe escapar comillas dobles internas', () => {
      expect(SqlEscape.ident('Mi"Tabla')).toBe('"Mi""Tabla"');
    });

    test('Debe manejar array de partes (schema.tabla)', () => {
      expect(SqlEscape.ident(['public', 'users'])).toBe('"public"."users"');
    });

    test('Debe lanzar error si no es string o array', () => {
      expect(() => SqlEscape.ident(123)).toThrow('SqlEscape.ident espera un string');
      expect(() => SqlEscape.ident(null)).toThrow('SqlEscape.ident espera un string');
    });
  });

  describe('val()', () => {
    test('Debe escapar string con comillas simples', () => {
      expect(SqlEscape.val("Pisco")).toBe("'Pisco'");
    });

    test('Debe escapar comillas simples internas', () => {
      expect(SqlEscape.val("O'Reilly")).toBe("'O''Reilly'");
    });

    test('Debe manejar numeros', () => {
      expect(SqlEscape.val(123)).toBe('123');
      expect(SqlEscape.val(45.67)).toBe('45.67');
    });

    test('Debe manejar booleanos', () => {
      expect(SqlEscape.val(true)).toBe('true');
      expect(SqlEscape.val(false)).toBe('false');
    });

    test('Debe manejar null/undefined como NULL', () => {
      expect(SqlEscape.val(null)).toBe('NULL');
      expect(SqlEscape.val(undefined)).toBe('NULL');
    });

    test('Debe formatear Date como TIMESTAMP de Firebird', () => {
      const date = new Date('2024-01-15T10:30:45.123Z');
      const result = SqlEscape.val(date);
      expect(result).toMatch(/^'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}'$/);
    });

    test('Debe lanzar error en tipos no soportados', () => {
      expect(() => SqlEscape.val({})).toThrow('Tipo no soportado');
      expect(() => SqlEscape.val([])).toThrow('Tipo no soportado');
    });
  });

  describe('Integracion con template strings (uso real)', () => {
    test('Debe construir SQL seguro interpolando ident()', () => {
      const tabla = 'users';
      const columna = 'name';
      const sql = `SELECT * FROM ${SqlEscape.ident(tabla)} WHERE ${SqlEscape.ident(columna)} = ?`;

      expect(sql).toBe('SELECT * FROM "users" WHERE "name" = ?');
    });

    test('Debe proteger contra inyeccion en nombres de tabla (trata input como identificador literal)', () => {
      const tablaMaliciosa = 'users; DROP TABLE users; --';
      const sql = `SELECT * FROM ${SqlEscape.ident(tablaMaliciosa)}`;

      // El input malicioso se convierte en un nombre de tabla literal escapado
      expect(sql).toBe('SELECT * FROM "users; DROP TABLE users; --"');

      // Verificacion de seguridad: El SQL resultante es una SOLA sentencia SELECT.
      // No contiene punto y coma sin comillas que separe sentencias.
      const statements = sql.split(';').filter(s => s.trim() && !s.includes('"'));
      expect(statements).toHaveLength(1); // Solo una sentencia real
    });
  });
});