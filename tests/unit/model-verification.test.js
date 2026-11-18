import { Sequelize } from '../../src/index.js';
import { DataTypes } from '../../src/core/data-types.js';

/**
 * Suite de pruebas para verificar la implementación de la Fase 2:
 * 1. Mapeo correcto de tipos de datos a SQL de Firebird.
 * 2. Registro correcto de modelos en la instancia de Sequelize.
 * 3. Comportamiento dinámico de los modelos (Proxy para acceso a propiedades).
 */
describe('Verificación Fase 2 - Modelos y Tipos de Datos', () => {
  const sequelize = new Sequelize({});

  test('Los DataTypes deben generar el SQL correcto para Firebird', () => {
    // Verifica que los tipos de datos se traducen a la sintaxis esperada por Firebird
    expect(DataTypes.INTEGER.toSql()).toBe('INTEGER');
    expect(DataTypes.BOOLEAN.toSql()).toBe('BOOLEAN');
    expect(DataTypes.STRING(50).toSql()).toBe('VARCHAR(50)');
    expect(DataTypes.TEXT.toSql()).toBe('BLOB SUB_TYPE TEXT');
  });

  test('sequelize.define debe registrar el modelo correctamente', () => {
    // Verifica que la factoría crea la clase, registra el nombre de tabla y los atributos
    const User = sequelize.define('User', {
      username: DataTypes.STRING(30),
      age: DataTypes.INTEGER
    }, { tableName: 'users' });

    expect(sequelize.models.User).toBe(User);
    expect(User.tableName).toBe('users');
    expect(User.attributes.username).toBeDefined();
  });

  test('La instancia del modelo debe usar Proxy correctamente', () => {
    // Verifica que el Proxy del Model permite acceso directo a las propiedades
    const User = sequelize.define('User', { name: DataTypes.STRING() });
    const user = new User({ name: 'Pisco' });

    expect(user.name).toBe('Pisco'); // Acceso vía Proxy
    user.name = 'Claude';
    expect(user.dataValues.name).toBe('Claude'); // Verificación interna actualizada
  });
});
