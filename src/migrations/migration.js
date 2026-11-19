/**
 * Clase base para las migraciones.
 *
 * Uso:
 *   module.exports = {
 *     up: async (queryInterface) => { ... },
 *     down: async (queryInterface) => { ... }
 *   };
 *
 * O extendiendo esta clase:
 *   class MiMigracion extends Migration {
 *     async up(queryInterface) { ... }
 *     async down(queryInterface) { ... }
 *   }
 */
export class Migration {
  constructor() {
    this.name = this.constructor.name;
  }

  /**
   * Método que se ejecuta al aplicar la migración (hacia adelante)
   * @param {QueryInterface} queryInterface
   * @returns {Promise<void>}
   */
  async up(queryInterface) {
    throw new Error('Método up() no implementado');
  }

  /**
   * Método que se ejecuta al revertir la migración (hacia atrás)
   * @param {QueryInterface} queryInterface
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    throw new Error('Método down() no implementado');
  }
}