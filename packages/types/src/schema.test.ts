import { describe, expect, it } from "vitest";
import {
  DataSchemaSchema,
  FieldSchemaSchema,
  FieldTypeSchema,
  FieldFormatSchema,
} from "./schema.js";

describe("FieldTypeSchema", () => {
  it("accepts valid field types", () => {
    expect(FieldTypeSchema.parse("string")).toBe("string");
    expect(FieldTypeSchema.parse("number")).toBe("number");
    expect(FieldTypeSchema.parse("boolean")).toBe("boolean");
    expect(FieldTypeSchema.parse("date")).toBe("date");
    expect(FieldTypeSchema.parse("array")).toBe("array");
    expect(FieldTypeSchema.parse("object")).toBe("object");
  });

  it("rejects invalid field type", () => {
    expect(() => FieldTypeSchema.parse("integer")).toThrow();
  });
});

describe("FieldFormatSchema", () => {
  it("accepts valid formats", () => {
    expect(FieldFormatSchema.parse("email")).toBe("email");
    expect(FieldFormatSchema.parse("url")).toBe("url");
    expect(FieldFormatSchema.parse("uuid")).toBe("uuid");
    expect(FieldFormatSchema.parse("date")).toBe("date");
  });

  it("rejects invalid format", () => {
    expect(() => FieldFormatSchema.parse("phone")).toThrow();
  });
});

describe("FieldSchemaSchema", () => {
  it("accepts valid field schema", () => {
    const field = {
      name: "email",
      type: "string" as const,
      format: "email" as const,
      nullable: false,
      example: "john@example.com",
    };
    expect(FieldSchemaSchema.parse(field)).toEqual(field);
  });

  it("accepts field without format", () => {
    const field = {
      name: "age",
      type: "number" as const,
      nullable: true,
      example: 25,
    };
    expect(FieldSchemaSchema.parse(field)).toEqual(field);
  });
});

describe("DataSchemaSchema", () => {
  it("accepts valid data schema", () => {
    const schema = {
      entity: "User",
      fields: [
        {
          name: "id",
          type: "number" as const,
          nullable: false,
          example: 1,
        },
        {
          name: "email",
          type: "string" as const,
          format: "email" as const,
          nullable: false,
          example: "john@example.com",
        },
      ],
      relationships: [
        {
          field: "organizationId",
          relatedEntity: "Organization",
        },
      ],
    };
    expect(DataSchemaSchema.parse(schema)).toEqual(schema);
  });

  it("accepts schema with empty relationships", () => {
    const schema = {
      entity: "Setting",
      fields: [
        {
          name: "key",
          type: "string" as const,
          nullable: false,
          example: "theme",
        },
      ],
      relationships: [],
    };
    expect(DataSchemaSchema.parse(schema)).toEqual(schema);
  });
});
