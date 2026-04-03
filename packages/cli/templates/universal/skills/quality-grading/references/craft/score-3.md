# Craft Calibration Example

## Score: 3 (Adequate Code Quality)

### Excerpt

```typescript
// user service
import db from './db';

function getUser(id) {
  return db.query('SELECT * FROM users WHERE id = ?', [id]);
}

function createUser(data) {
  if (!data.email) return null;
  return db.query('INSERT INTO users SET ?', data);
}

async function updateUser(id, data) {
  // simple update
  return db.query('UPDATE users SET ? WHERE id = ?', [data, id]);
}

module.exports = { getUser, createUser, updateUser };
```

### Justification

- Basic error handling (checks for email) but inconsistent
- No doc comments explaining function behavior
- Uses callback style mixed with async - inconsistent patterns
- Some validation present but edge cases not fully handled
- No JSDoc or documentation for parameters/return values

### Score: 3
