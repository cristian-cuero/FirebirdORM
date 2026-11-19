/**
 * Clase base para todas las asociaciones (HasMany, BelongsTo, HasOne, BelongsToMany).
 * Define la lógica común para generación de JOINs y resolución de claves foráneas.
 */
export class Association {
  /**
   * @param {typeof Model} sourceModel - Modelo origen (donde se define la asociación)
   * @param {typeof Model} targetModel - Modelo destino (relacionado)
   * @param {object} options - Opciones: foreignKey, as, onDelete, onUpdate, etc.
   */
  constructor(sourceModel, targetModel, options = {}) {
    this.sourceModel = sourceModel;
    this.targetModel = targetModel;
    this.options = options;

    // Alias para acceder a la relación (ej: user.posts vs user.getPosts())
    this.as = options.as || this.getDefaultAlias();

    // Nombre de la FK en la tabla destino o origen según tipo
    this.foreignKey = options.foreignKey || this.getDefaultForeignKey();

    // Nombre de la PK del modelo fuente (por defecto 'id')
    this.sourceKey = options.sourceKey || 'id';

    // Nombre de la PK del modelo destino
    this.targetKey = options.targetKey || 'id';

    // Tipo de JOIN por defecto para eager loading
    this.joinType = options.required ? 'INNER JOIN' : 'LEFT JOIN';
  }

  /**
   * Alias por defecto: nombre del modelo destino en minúscula (singular para BelongsTo/HasOne, plural para HasMany)
   */
  getDefaultAlias() {
    const name = this.targetModel.name;
    return name.toLowerCase();
  }

  /**
   * FK por defecto: sourceModelName + 'Id' (ej: userId)
   * Se sobrescribe en subclases según dónde vive la FK.
   */
  getDefaultForeignKey() {
    return `${this.sourceModel.name.toLowerCase()}Id`;
  }

  /**
   * Devuelve la condición ON para el JOIN SQL.
   * Ej: "users.id = posts.user_id"
   */
  getJoinCondition() {
    const sourceTable = this.sourceModel.tableName;
    const targetTable = this.targetModel.tableName;
    return `${sourceTable}.${this.sourceKey} = ${targetTable}.${this.foreignKey}`;
  }

  /**
   * Indica si la FK está en la tabla DESTINO (target).
   * true  -> FK en target (HasMany, HasOne)
   * false -> FK en source (BelongsTo)
   */
  isForeignKeyOnTarget() {
    return true; // Default para HasMany/HasOne
  }

  /**
   * Indica si es una relación 1:N (collection) o 1:1 (single).
   * Se usa en `groupIncludes` para decidir array vs objeto.
   */
  isCollection() {
    return false; // Default: single (BelongsTo, HasOne)
  }

  /**
   * Tipo de asociación para identificación
   */
  get associationType() {
    return this.constructor.name;
  }
}