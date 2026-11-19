import { Association } from './base.js';

/**
 * Relación 1:1 - La FK vive en la tabla DESTINO (target).
 * Ej: User.hasOne(Profile) -> profiles.user_id
 */
export class HasOne extends Association {
  isForeignKeyOnTarget() {
    return true; // FK en tabla target (Profile tiene user_id)
  }

  isCollection() {
    return false; // Devuelve objeto único: user.profile = Profile
  }

  getDefaultAlias() {
    // Por defecto singular: profile
    return this.targetModel.name.toLowerCase();
  }
}