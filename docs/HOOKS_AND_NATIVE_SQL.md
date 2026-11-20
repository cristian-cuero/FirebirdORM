# Guía de Hooks y SQL Nativo - firebird-orm

## 1. Hooks (Ciclo de Vida)
Los Hooks permiten ejecutar lógica personalizada antes o después de eventos específicos en los modelos.

### Eventos disponibles:
*   `beforeCreate` / `afterCreate`
*   `beforeUpdate` / `afterUpdate`
*   `beforeDestroy` / `afterDestroy`

### Cómo usarlos en la definición del modelo:
```javascript
const User = sequelize.define('User', {
  id: DataTypes.INTEGER,
  password: DataTypes.STRING
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user, options) => {
      // Ejemplo: Encriptar password antes de guardar
      user.password = await hashPassword(user.password);
    },
    afterCreate: (user, options) => {
      console.log(`Usuario creado: ${user.id}`);
    }
  }
});
```

---

## 2. Ejecución de SQL Nativo (queryRaw)
Para situaciones donde el ORM no es suficiente (consultas complejas, SPs legacy, DDL), usamos `queryRaw`.

### Inserción de valores seguros
**IMPORTANTE:** Nunca concatene strings. Utilice el array `replacements` para prevenir **SQL Injection**. El motor de Firebird recibe los parámetros por separado, garantizando seguridad absoluta.

#### Uso básico:
```javascript
// El '?' actúa como placeholder
const results = await sequelize.queryRaw(
  'SELECT * FROM users WHERE status = ? AND age > ?',
  { replacements: ['ACTIVE', 18] }
);
```

#### Uso avanzado:
```javascript
// Uso dentro de una transacción
const t = await Transaction.start(sequelize);
try {
  await sequelize.queryRaw(
    'UPDATE users SET last_login = ? WHERE id = ?',
    { 
      replacements: [new Date(), 1],
      transaction: t 
    }
  );
  await t.commit();
} catch (e) {
  await t.rollback();
}
```

---

## 3. Consideraciones para nuevos desarrolladores
1.  **Mapeo de Tipos:** El ORM maneja la conversión entre JS y Firebird automáticamente (Date, Number, String). Si usas `queryRaw`, asegúrate de usar `CAST` en tu SQL si el driver no detecta automáticamente el tipo (ej. `CAST(? AS INTEGER)`).
2.  **Identificadores:** Usa `SqlEscape.ident('Tabla_Legacy')` si necesitas escapar nombres de tablas o columnas con caracteres especiales o sensibles a mayúsculas/minúsculas.
3.  **Transacciones:** Siempre libera la conexión. Si usas `Transaction.start()`, el objeto `Transaction` gestiona el cierre automáticamente en `commit()` o `rollback()`.
4.  **Case Sensitivity:** Firebird por defecto devuelve los nombres de las columnas en MAYÚSCULAS si la tabla fue creada sin comillas dobles. Si usas nombres de columnas complejos o creados entre comillas, el driver respetará el *case* que definiste en el modelo.
