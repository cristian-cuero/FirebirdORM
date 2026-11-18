/**
 * Clase base para todas las asociaciones (HasMany, BelongsTo, HasOne, BelongsToMany).
 */
export class Association {
  /**
   * @param {typeof Model} sourceModel
   * @param {typeof Model} targetModel
   * @param {object} options
   */
  constructor(sourceModel, targetModel, options = {}) {
    this.sourceModel = sourceModel;
    this.targetModel = targetModel;
    this.options = options;
    this.foreignKey = options.foreignKey || this.getDefaultForeignKey();
  }

  /**
   * Infiere el nombre de la FK si no se proporciona (ej: userId)
   */
  getDefaultForeignKey() {
    return `${this.sourceModel.name.toLowerCase()}Id`;
  }
}
