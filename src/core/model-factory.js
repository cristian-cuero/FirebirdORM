import { Model } from './model.js';
import { HasMany } from './associations/has-many.js';
import { BelongsTo } from './associations/belongs-to.js';
import { HasOne } from './associations/has-one.js';
import { BelongsToMany } from './associations/belongs-to-many.js';

/**
 * Define un nuevo modelo en el sistema.
 * @param {object} sequelize - Instancia de Sequelize
 * @param {string} name - Nombre del modelo
 * @param {object} attributes - Definición de atributos y DataTypes
 * @param {object} options - Opciones de configuración (tableName, timestamps, etc)
 * @returns {typeof Model} - Clase del modelo creado
 */
export function defineModel(sequelize, name, attributes, options = {}) {
  // Detectar la clave primaria
  const primaryKeyAttribute = Object.keys(attributes).find(key => attributes[key].primaryKey) || 'id';

  class ModelInstance extends Model {
    static get tableName() {
      return options.tableName || name.toLowerCase() + 's';
    }

    static get attributes() {
      return attributes;
    }

    static get hooks() {
      return options.hooks || {};
    }

    static get primaryKeyAttribute() {
      return primaryKeyAttribute;
    }

    // Inyectamos la instancia de sequelize al modelo
    static get sequelize() {
      return sequelize;
    }

    // Métodos de asociación
    static hasMany(target, options) {
      this.associations[target.name] = new HasMany(this, target, options);
    }
    static belongsTo(target, options) {
      this.associations[target.name] = new BelongsTo(this, target, options);
    }
    static hasOne(target, options) {
      this.associations[target.name] = new HasOne(this, target, options);
    }
    static belongsToMany(target, options) {
      this.associations[target.name] = new BelongsToMany(this, target, options);
    }
  }

  // Inicializamos almacenamiento de asociaciones
  ModelInstance.associations = {};

  // Asignamos el nombre de la clase dinámicamente
  Object.defineProperty(ModelInstance, 'name', { value: name });

  return ModelInstance;
}