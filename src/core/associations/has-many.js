import { Association } from './base.js';

/**
 * Relación 1:N - La FK vive en la tabla DESTINO (target).
 * Ej: User.hasMany(Post) -> posts.user_id
 */
export class HasMany extends Association {
  isForeignKeyOnTarget() {
    return true; // FK en tabla target (Post tiene user_id)
  }

  isCollection() {
    return true; // Devuelve array: user.posts = [Post, Post]
  }

  getDefaultAlias() {
    // Por defecto plural: posts
    return this.targetModel.name.toLowerCase() + 's';
  }

  /**
   * JOIN: source.id = target.foreignKey
   * Ej: users.id = posts.user_id
   */
  getJoinCondition() {
    const sourceTable = this.sourceModel.tableName;
    const targetTable = this.targetModel.tableName;
    return `${sourceTable}.${this.sourceKey} = ${targetTable}.${this.foreignKey}`;
  }
}