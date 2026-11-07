# DIM-7: Migration Inventory

**Question:** Did the agent identify ALL components?

## Scoring Rubric

| Score | Descriptor |
|-------|------------|
| 5 | All components identified, no missing modules, services, or dependencies |
| 4 | >95% identified, minor peripheral components missed |
| 3 | Core components identified, some utilities/helper modules missed |
| 2 | Major components identified, significant modules missed |
| 1 | Only the most obvious components identified |

## Audit Questions

1. List every component in the legacy system
2. For each: what is its purpose, what does it depend on, what depends on it?
3. What is your completeness confidence? (Percentage)
4. What components were NOT migrated? Why?

## Evidence Requirements

- Complete component inventory with dependencies
- Component migration status
- Missing component justification (if any)

## Inventory Checklist

- [ ] Core business logic modules
- [ ] API/endpoint handlers
- [ ] Database/models
- [ ] Authentication/authorization
- [ ] Configuration management
- [ ] Logging and monitoring
- [ ] Background jobs/cron
- [ ] Utility/helper functions
- [ ] Shared libraries
- [ ] External service integrations

## Auto-Fix

Not applicable — inventory completeness requires human verification.

## Probing Questions

- "Did you find all the API endpoints?"
- "Are there any background jobs?"
- "What utility modules are used?"