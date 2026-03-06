# Data Generator

Generates realistic fake data using Faker.js based on inferred schemas.

## Acceptance Criteria

- [ ] Generates data matching schema structure
- [ ] Data is realistic (uses Faker.js)
- [ ] Maintains referential integrity between entities
- [ ] Uses recorded examples as templates

## Interface

```typescript
interface GenerationRequest {
  schema: DataSchema;
  count: number;
  examples: any[];
  context?: string;
}

export function generate(request: GenerationRequest): any[];

export function generateAll(
  schemas: DataSchema[],
  examples: Record<string, any[]>
): Record<string, any[]>;
```

## Faker.js Mapping

Map schema field formats to Faker methods:

```typescript
const fakerMap: Record<string, () => any> = {
  email: () => faker.internet.email(),
  name: () => faker.person.fullName(),
  firstName: () => faker.person.firstName(),
  lastName: () => faker.person.lastName(),
  phone: () => faker.phone.number(),
  url: () => faker.internet.url(),
  uuid: () => faker.string.uuid(),
  date: () => faker.date.recent(),
  paragraph: () => faker.lorem.paragraph(),
  sentence: () => faker.lorem.sentence(),
  number: () => faker.number.int({ min: 1, max: 1000 }),
  boolean: () => faker.datatype.boolean(),
};
```

## Testing Requirements

### Unit Tests (`data-generator.test.ts`)
- Test each field type generates correct format
- Test schema validation
- Test referential integrity (foreign keys)
- Test count parameter works

### Integration Tests (`data-generator.integration.test.ts`)
- Generate 10 user records, verify all valid
- Generate users + emails, verify foreign keys match
- Generate from real schema, verify realistic output

## Definition of Done

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Generated data matches schema types
- [ ] Emails look like emails, names like names
- [ ] Foreign keys reference valid records
