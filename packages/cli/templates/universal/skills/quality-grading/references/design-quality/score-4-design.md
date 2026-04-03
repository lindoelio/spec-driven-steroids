# Design Quality Calibration Example

## Score: 4 (Good Design Document)

### Excerpt

```markdown
# System Architecture

## Module Overview

### Auth Module
- Responsibility: User authentication and session management
- Boundaries: REST API boundary, database boundary
- Dependencies: PostgreSQL (users), Redis (sessions)

### Order Module
- Responsibility: Order lifecycle management
- Boundaries: REST API boundary, message queue boundary
- Dependencies: PostgreSQL (orders), Kafka (events)

### Notification Module
- Responsibility: Async notification delivery
- Boundaries: Message queue consumer boundary
- Dependencies: Kafka (subscribe), SMTP/API providers
```

### Justification

- Clear module boundaries with well-defined responsibilities
- Good separation of concerns across auth, orders, notifications
- Scalability considerations (async messaging, Redis sessions)
- Dependency flow is clear between modules
- Minor gap: no circuit breakers or retry policies documented

### Score: 4
