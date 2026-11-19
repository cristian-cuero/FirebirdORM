import { Association } from './base.js';

/**
 * Relación N:1 - La FK vive en la tabla ORIGEN (source).
 * Ej: Post.belongsTo(User) -> posts.user_id
 */
export class BelongsTo extends Association {
  isForeignKeyOnTarget() {
    return false; // FK en tabla source (Post tiene user_id)
  }

  isCollection() {
    return false; // Devuelve objeto único: post.user = User
  }

  getJoinCondition() {
    // En BelongsTo, la condición es al revés: target.id = source.foreignKey
    const sourceTable = this.sourceModel.tableName;
    const targetTable = this.targetModel.tableName;
    return `${targetTable}.${this.targetKey} = ${sourceTable}.${this.foreignKey}`;
  }

  getDefaultAlias() {
    // Por defecto singular: user
    return this.targetModel.name.toLowerCase();
  }
}