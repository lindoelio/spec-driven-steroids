# Originality Calibration Example

## Score: 3 (Mix of Generic and Tailored)

### Excerpt

```typescript
// Standard CRUD service boilerplate
class DataService {
  async getAll() {
    return this.db.query('SELECT * FROM data');
  }

  async getById(id: string) {
    return this.db.query('SELECT * FROM data WHERE id = ?', [id]);
  }

  async create(data: any) {
    return this.db.query('INSERT INTO data SET ?', data);
  }

  async update(id: string, data: any) {
    return this.db.query('UPDATE data SET ? WHERE id = ?', [data, id]);
  }

  async delete(id: string) {
    return this.db.query('DELETE FROM data WHERE id = ?', [id]);
  }
}
```

### Justification

- Pure boilerplate CRUD patterns copied from tutorials
- No domain-specific logic or concepts
- Generic "data" naming instead of domain terminology
- No adaptation to the actual problem being solved
- Standard error handling without problem-specific considerations

### Score: 3
