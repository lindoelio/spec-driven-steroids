# Craft Calibration Example

## Score: 4 (Good Code Quality)

### Excerpt

```typescript
import db from './db';

/**
 * Retrieves a user by their unique identifier.
 * 
 * @param id - The user's UUID
 * @returns The user object or null if not found
 * @throws {DatabaseError} When connection fails
 */
async function getUser(id: string): Promise<User | null> {
  if (!id) {
    throw new ValidationError('User ID is required');
  }
  
  try {
    const result = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return result.rows[0] || null;
  } catch (error) {
    throw new DatabaseError('Failed to retrieve user', { cause: error });
  }
}

/**
 * Creates a new user with the provided data.
 * 
 * @param data - User creation data
 * @param data.email - Required valid email address
 * @param data.name - Required user display name
 * @returns The created user object
 * @throws {ValidationError} When required fields are missing
 * @throws {DatabaseError} When creation fails
 */
async function createUser(data: CreateUserInput): Promise<User> {
  validateCreateInput(data);
  
  try {
    const result = await db.query('INSERT INTO users SET ? RETURNING *', data);
    return result.rows[0];
  } catch (error) {
    throw new DatabaseError('Failed to create user', { cause: error });
  }
}
```

### Justification

- Comprehensive JSDoc comments explaining behavior, parameters, and errors
- Good error handling with typed errors (ValidationError, DatabaseError)
- Consistent async/await patterns
- Input validation helper function used
- Clear separation of concerns

### Score: 4
