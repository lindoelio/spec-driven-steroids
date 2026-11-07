# Design Quality Calibration Example

## Score: 4 (Good)

### Excerpt

```typescript
// user service - clean architecture
import { UserRepository } from '../repositories/user.repository';
import { UserValidator } from '../validators/user.validator';
import { EventEmitter } from '../events/emitter';
import { Cache } from '../cache/redis';

export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly validator: UserValidator,
    private readonly events: EventEmitter,
    private readonly cache: Cache
  ) {}

  async getUser(id: string): Promise<User | null> {
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;
    
    const user = await this.userRepo.findById(id);
    if (user) await this.cache.set(`user:${id}`, user, 300);
    return user;
  }

  async createUser(data: CreateUserInput): Promise<User> {
    const validationResult = this.validator.validate(data);
    if (!validationResult.valid) {
      throw new ValidationError(validationResult.errors);
    }
    
    const user = await this.userRepo.create(data);
    this.events.emit('user.created', user);
    return user;
  }
}
```

### Justification

- Clear dependency injection pattern with explicit interfaces
- Good separation: service handles business logic, repository handles data access
- Scalability consideration with caching layer
- Event emission for loose coupling
- Minor gap: no retry policies or circuit breakers for external dependencies

### Score: 4
