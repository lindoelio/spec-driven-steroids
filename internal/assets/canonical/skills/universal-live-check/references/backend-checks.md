# Backend Checks

API, service, and server-side validation for web services, APIs, and data processing.

## Backend Domain Signals

- `package.json` with web frameworks (Express, Fastify, NestJS, Next.js API routes)
- `pyproject.toml` / `requirements.txt` with web frameworks (Django, FastAPI, Flask)
- `go.mod` with net/http, gin, echo, fiber imports
- `Cargo.toml` with web frameworks (axum, actix, rocket)
- `docker-compose.yml` / `Dockerfile` for services
- `server/` or `api/` or `services/` directories

## Backend-Specific Check Categories

### 1. API Contract Validation

```
- All endpoints have request schemas defined
- All endpoints have response schemas defined
- Content-Type is correctly set (application/json)
- Status codes are correct (200, 201, 400, 404, 500)
- Required fields are marked required
- Optional fields have defaults
- No response schema for 204 No Content
```

### 2. Input Validation & Sanitization

```
- All user input is validated (types, ranges, formats)
- SQL queries use parameterized statements
- File paths are validated (no path traversal)
- URLs are validated before fetching
- File uploads have size limits
- JSON parsing errors are handled gracefully
```

### 3. Authentication & Authorization

```
- Protected routes verify auth token
- Authorization checks user owns resource
- Token expiration is enforced
- Secrets are not in code or logs
- CORS is configured correctly
- Rate limiting is present on public endpoints
```

### 4. Error Handling

```
- Errors return consistent JSON structure
- Stack traces not exposed to clients
- Database connection errors handled
- Timeout errors handled
- Retry logic with backoff for external services
- All exceptions logged server-side
```

### 5. Data Integrity

```
- Database transactions for multi-step writes
- ID generation is consistent (UUID, auto-increment)
- Timestamps use UTC
- Soft deletes preserve data
- Migrations are reversible
```

### 6. Configuration

```
- Environment variables have defaults
- Required env vars documented
- Secrets loaded from env, not hardcoded
- Feature flags don't break on missing keys
- Config validated at startup
```

## Quick Backend Checks

Run these first (fast, high signal):

```bash
# Syntax check
node --check server.js
python -m py_compile server.py
go build -o /dev/null ./...

# Dependency check
npm ls --depth=0
pip check
go mod verify

# Config syntax check
docker-compose config
```

## Backend Check Examples

### Example: REST Endpoint Validation

```typescript
// Express.js
app.post('/users', async (req, res) => {
  const { email, name } = req.body;
  
  // Check: Input validation present
  if (!email || !name) {
    return res.status(400).json({ error: 'email and name required' });
  }
  
  // Check: Email format validation
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'invalid email format' });
  }
  
  // Check: SQL injection prevention
  const user = await db.query(
    'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
    [email, name]
  );
  
  // Check: Status code 201 for created
  res.status(201).json(user);
});
```

**Check清单:**
- [ ] Input validation present
- [ ] Email format validated
- [ ] Parameterized query (no string interpolation)
- [ ] Correct status code (201 for create)
- [ ] Error response is JSON

### Example: FastAPI Endpoint Validation

```python
from pydantic import BaseModel, EmailStr
from fastapi import FastAPI, HTTPException

app = FastAPI()

class UserCreate(BaseModel):
    email: EmailStr  # Check: Pydantic validation
    name: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str

@app.post("/users", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate):
    # Check: Pydantic handles validation automatically
    new_user = await db.create_user(user)
    return new_user
```

**Check清单:**
- [ ] Request model with validation (Pydantic)
- [ ] Response model defined
- [ ] Status code specified
- [ ] EmailStr for email validation

## Common Backend Bugs

| Bug | Symptom | Check |
|-----|---------|-------|
| SQL injection | Data breach | Parameterized queries only |
| Password in logs | Compliance violation | No password fields logged |
| 200 on errors | Silent failures | Error status codes always used |
| Missing auth | Security bypass | Middleware on protected routes |
| Memory leaks | OOM crashes | Streaming for large responses |
| No timeouts | Hanging requests | Timeout on all external calls |
| Missing imports | Runtime crashes | All imported modules declared in deps |

## Cross-Domain Contamination Check

When backend code is found, check for cross-domain issues:

```
Backend files (api/, server/, routes/) often import from:
- libs/ - shared utilities
- frontend/ - SSR imports
- Mobile apps via API
```

**Contamination pattern:**
```
api/users.ts uses: bcrypt, express-validator
package.json declares: express, pg
                              ↑ bcrypt NOT declared!
```

**Check:** For every import in backend files:
1. Verify the imported module is in package.json dependencies
2. Verify the import resolves to an actual export
3. Flag any import from a local `lib/` directory as requiring libs checks
