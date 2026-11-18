import { Association } from './base.js';

/**
 * Asociación Muchos a Muchos.
 * Requiere una tabla intermedia (through).
 */
export class BelongsToMany extends Association {
  constructor(sourceModel, targetModel, options = {}) {
    if (!options.through) {
      throw new Error('BelongsToMany requiere la opción "through" (nombre tabla intermedia o modelo).');
    }
    super(sourceModel, targetModel, options);
    this.through = options.through;
    this.foreignKey = options.foreignKey || this.getDefaultForeignKey();
    this.otherKey = options.otherKey || `${this.targetModel.name.toLowerCase()}Id`;
  }
}