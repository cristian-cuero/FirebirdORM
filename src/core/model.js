import { DatabaseError, ValidationError } from './errors.js';

/**
 * Clase base para todos los modelos del ORM.
 */
export class Model {
  /**
   * @param {object} values - Datos iniciales de la instancia
   */
  constructor(values = {}) {
    // Normalizar claves a minúsculas para acceso case-insensitive
    // Manejar formato "tabla.campo" del driver
    this.dataValues = {};
    for (const key in values) {
      let normalizedKey = key.toLowerCase();
      // Si viene con alias "tabla.campo", quitar el prefijo
      if (normalizedKey.includes('.')) {
        normalizedKey = normalizedKey.split('.').pop();
      }
      this.dataValues[normalizedKey] = values[key];
    }

    // Proxy para acceder a dataValues directamente como propiedades (case-insensitive)
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) return target[prop];
        // Buscar en dataValues normalizado a minúsculas
        return target.dataValues[prop.toString().toLowerCase()];
      },
      set(target, prop, value) {
        if (prop in target) {
          target[prop] = value;
        } else {
          target.dataValues[prop.toString().toLowerCase()] = value;
        }
        return true;
      },
    });
  }

  /**
   * Método para obtener los datos puros
   */
  toJSON() {
    return { ...this.dataValues };
  }

  /**
   * Dispara un hook si existe
   */
  static async triggerHook(hookName, instanceOrValues, options = {}) {
    const hook = this.hooks[hookName];
    if (hook && typeof hook === 'function') {
      await hook(instanceOrValues, options);
    }
  }

  /**
   * Valida la instancia según las definiciones de los atributos
   * @throws {ValidationError} Si alguna validación falla
   */
  validate() {
    const attributes = this.constructor.attributes;

    for (const [attrName, attrDef] of Object.entries(attributes)) {
      const value = this.dataValues[attrName];

      // Validación allowNull
      if (attrDef.allowNull === false && (value === null || value === undefined)) {
        throw new ValidationError(`${attrName} no puede ser nulo (allowNull: false)`);
      }
    }
  }

  /**
   * Inserta un nuevo registro
   */
  static async create(values) {
    try {
      await this.triggerHook('beforeCreate', values);

      const instance = new this(values);
      // Validar antes de insertar
      instance.validate();

      const { sql, params } = this.sequelize.dialect.queryGenerator.insertQuery(this, values);
      await this.sequelize.query(sql, params);

      await this.triggerHook('afterCreate', instance);
      return instance;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError(`Error al insertar en ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Actualiza registros
   */
  static async update(values, options) {
    try {
      await this.triggerHook('beforeUpdate', values, options);
      const { sql, params } = this.sequelize.dialect.queryGenerator.updateQuery(this, values, options);
      const result = await this.sequelize.query(sql, params);
      await this.triggerHook('afterUpdate', values, options);
      return result;
    } catch (error) {
      throw new DatabaseError(`Error al actualizar en ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Elimina registros
   */
  static async destroy(options) {
    try {
      await this.triggerHook('beforeDestroy', options);
      const { sql, params } = this.sequelize.dialect.queryGenerator.deleteQuery(this, options);
      const result = await this.sequelize.query(sql, params);
      await this.triggerHook('afterDestroy', options);
      return result;
    } catch (error) {
      throw new DatabaseError(`Error al eliminar en ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Busca registros
   */
  static async findAll(options = {}) {
    try {
      const { sql, params } = this.sequelize.dialect.queryGenerator.selectQuery(this, options);
      // Pasamos options para soporte de transaction
      const rows = await this.sequelize.query(sql, params, options);

      if (options.include && rows.length > 0) {
        return this.groupIncludes(rows, options);
      }

      return rows.map(row => new this(row));
    } catch (error) {
      throw new DatabaseError(`Error al consultar ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Busca un único registro
   */
  static async findOne(options = {}) {
    const results = await this.findAll({ ...options, limit: 1 });
    return results[0] || null;
  }

  /**
   * Busca por clave primaria
   */
  static async findByPk(id, options = {}) {
    return this.findOne({ ...options, where: { id } });
  }

  /**
   * Cuenta registros
   */
  static async count(options = {}) {
    try {
      const { sql, params } = this.sequelize.dialect.queryGenerator.countQuery(this, options);
      const results = await this.sequelize.query(sql, params, options);
      // Firebird devuelve COUNT en primera columna (COUNT, count, o nombre del alias)
      const firstRow = results[0] || {};
      const countValue = firstRow.COUNT ?? firstRow.count ?? Object.values(firstRow)[0] ?? 0;
      return parseInt(countValue, 10);
    } catch (error) {
      throw new DatabaseError(`Error al contar ${this.tableName}: ${error.message}`);
    }
  }

  /**
   * Agrupa filas aplanadas de un JOIN en objetos anidados.
   */
  static groupIncludes(rows, options) {
    const resultMap = new Map();

    for (const row of rows) {
      // Normalizar claves a MAYÚSCULAS (Firebird/aliases) para buscar
      const normalizedRow = {};
      for (const key in row) normalizedRow[key.toUpperCase()] = row[key];

      const pkValue = normalizedRow[`${this.tableName.toUpperCase()}.ID`];

      let parentInstance = resultMap.get(pkValue);
      if (!parentInstance) {
        const parentData = {};
        for (const [key, value] of Object.entries(normalizedRow)) {
          if (key.startsWith(`${this.tableName.toUpperCase()}.`)) {
            const fieldName = key.split('.')[1].toLowerCase();
            parentData[fieldName] = value;
          }
        }
        parentInstance = new this(parentData);
        parentInstance.dataValues.posts = []; // array vacío por defecto
        resultMap.set(pkValue, parentInstance);
      }

      options.include.forEach(targetModel => {
        const targetTable = targetModel.tableName.toUpperCase();
        const childData = {};
        let hasChildData = false;

        for (const [key, value] of Object.entries(normalizedRow)) {
          if (key.startsWith(`${targetTable}.`)) {
            const fieldName = key.split('.')[1].toLowerCase();
            childData[fieldName] = value;
            if (value !== null) hasChildData = true;
          }
        }

        if (hasChildData) {
          // Usar el nombre del modelo en plural minúscula (post -> posts)
          // Debe ser minúscula para que el Proxy case-insensitive la encuentre
          const relName = targetModel.name.toLowerCase() + 's';
          if (!parentInstance.dataValues[relName]) parentInstance.dataValues[relName] = [];
          // Crear instancia del modelo hijo para que tenga Proxy y acceso case-insensitive
          parentInstance.dataValues[relName].push(new targetModel(childData));
        }
      });
    }
    return Array.from(resultMap.values());
  }
}