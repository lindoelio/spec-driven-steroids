# Design Quality Calibration Example

## Score: 3 (Adequate)

### Excerpt

```typescript
// user module
import { db } from '../db';
import { validation } from '../utils';

function getUser(id) {
  return db.query('SELECT * FROM users WHERE id = ?', [id]);
}

function createUser(data) {
  if (!validation.isEmail(data.email)) {
    return { error: 'Invalid email' };
  }
  return db.query('INSERT INTO users SET ?', data);
}

export { getUser, createUser };
```

### Justification

- Recognizable module structure with separate functions
- Database and validation are external dependencies
- Limited separation: business logic and data access are mixed in functions
- No interface definitions or type contracts
- No clear scalability patterns (e.g., caching, connection pooling)

### Score: 3
