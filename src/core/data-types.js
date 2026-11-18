/**
 * Tipos de datos soportados para el mapeo a Firebird.
 */
class DataType {
  constructor(key, options = {}) {
    this.key = key;
    this.options = options;
  }
  toSql() {
    return this.key;
  }
}

// Tipos con longitud variable (ej: VARCHAR)
class VarDataType extends DataType {
  toSql() {
    return `${this.key}(${this.options.length || 255})`;
  }
}

export const DataTypes = {
  // Tipos simples
  INTEGER: new DataType('INTEGER'),
  BIGINT: new DataType('BIGINT'),
  FLOAT: new DataType('FLOAT'),
  DOUBLE: new DataType('DOUBLE PRECISION'),
  DATE: new DataType('TIMESTAMP'),
  BOOLEAN: new DataType('BOOLEAN'), // FB 3.0+
  TEXT: new DataType('BLOB SUB_TYPE TEXT'),

  // Tipos con configuración
  STRING: (length = 255) => new VarDataType('VARCHAR', { length }),

  // Helper para facilitar el acceso
  isDataType: (obj) => obj instanceof DataType || obj instanceof VarDataType
};
