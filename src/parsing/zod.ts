/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Layer } from "effect";
import { z } from "zod";
import { ZodGenerator } from "~/context";
import type {
  ZodSchema,
  ZodObject,
  ZodType,
  ZodEnum,
} from "~/domain/zod-ast";
import { ValidationError, CodeGenerationError } from "~/domain/errors";

// Input validation schema
const InputValidationSchema = z.object({
  enums: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string()),
      documentation: z.string().optional(),
    })
  ),
  objects: z.array(
    z.object({
      name: z.string(),
      fields: z.array(
        z.object({
          name: z.string(),
          type: z.custom<ZodType>((val: unknown) => val !== null && typeof val === "object"),
          documentation: z.string().optional(),
        })
      ),
      documentation: z.string().optional(),
    })
  ),
});

// Type generation strategies
const TYPE_GENERATORS: Record<string, (type: ZodType) => string> = {
  ZodString: (type) =>
    type._tag === "ZodString"
      ? generateStringType(type.validations)
      : "z.string()",
  ZodNumber: (type) =>
    type._tag === "ZodNumber"
      ? generateNumberType(type.validations)
      : "z.number()",
  ZodBigInt: () => "z.bigint()",
  ZodBoolean: () => "z.boolean()",
  ZodDate: () => "z.date()",
  ZodNull: () => "z.null()",
  ZodUndefined: () => "z.undefined()",
  ZodNaN: () => "z.nan()",
  ZodUnknown: () => "z.unknown()",
  ZodLiteral: (type) =>
    type._tag === "ZodLiteral"
      ? `z.literal(${JSON.stringify(type.value)})`
      : "z.unknown()",
  ZodArray: (type) =>
    type._tag === "ZodArray"
      ? `z.array(${generateType(type.element)})`
      : "z.array(z.unknown())",
  ZodTuple: (type) =>
    type._tag === "ZodTuple"
      ? `z.tuple([${type.items.map(generateType).join(", ")}])`
      : "z.unknown()",
  ZodUnion: (type) =>
    type._tag === "ZodUnion"
      ? `z.union([${type.options.map(generateType).join(", ")}])`
      : "z.unknown()",
  ZodRecord: (type) =>
    type._tag === "ZodRecord"
      ? `z.record(${generateType(type.keyType)}, ${generateType(type.valueType)})`
      : "z.unknown()",
  ZodObject: (type) =>
    type._tag === "ZodObject" ? `${type.name}Schema` : "z.unknown()",
  ZodEnum: (type) =>
    type._tag === "ZodEnum" ? `${type.name}Schema` : "z.unknown()",
  ZodOptional: (type) =>
    type._tag === "ZodOptional"
      ? `${generateType(type.inner)}.optional()`
      : "z.unknown()",
  ZodNullable: (type) =>
    type._tag === "ZodNullable"
      ? `${generateType(type.inner)}.nullable()`
      : "z.unknown()",
  ZodDefault: (type) =>
    type._tag === "ZodDefault"
      ? type.defaultValue !== undefined
        ? `${generateType(type.inner)}.default(${JSON.stringify(type.defaultValue)})`
        : generateType(type.inner) // Skip .default() for undefined values (function defaults)
      : "z.unknown()",
};

// Generate Zod type expression (exported for modular generation)
export function generateType(type: ZodType): string {
  const generator = TYPE_GENERATORS[type._tag];
  if (!generator) {
    throw new Error(`Unknown Zod type tag: "${type._tag}"`);
  }
  return generator(type);
}

// String validation strategies
const STRING_VALIDATIONS: Record<
  string,
  (val: import("~/domain/zod-ast").StringValidation) => string
> = {
  MinLength: (v) => `.min(${(v as { value: number }).value})`,
  MaxLength: (v) => `.max(${(v as { value: number }).value})`,
  Length: (v) => `.length(${(v as { value: number }).value})`,
  Email: () => ".email()",
  Url: () => ".url()",
  Uuid: () => ".uuid()",
  Cuid: () => ".cuid()",
  Cuid2: () => ".cuid2()",
  Ulid: () => ".ulid()",
  Nanoid: () => ".nanoid()",
  Datetime: () => ".datetime()",
  Ip: (v) => {
    const ipVal = v as { version?: "v4" | "v6" };
    return ipVal.version ? `.ip({ version: "${ipVal.version}" })` : ".ip()";
  },
  Regex: (v) => `.regex(/${(v as { pattern: string }).pattern}/)`,
  Emoji: () => ".emoji()",
  Base64: () => ".base64()",
  Trim: () => ".trim()",
  ToLowerCase: () => ".toLowerCase()",
  ToUpperCase: () => ".toUpperCase()",
  StartsWith: (v) => `.startsWith(${JSON.stringify((v as { value: string }).value)})`,
  EndsWith: (v) => `.endsWith(${JSON.stringify((v as { value: string }).value)})`,
  Includes: (v) => `.includes(${JSON.stringify((v as { value: string }).value)})`,
};

// Generate string type with validations
function generateStringType(
  validations: ReadonlyArray<import("~/domain/zod-ast").StringValidation>
): string {
  let result = "z.string()";

  for (const validation of validations) {
    const generator = STRING_VALIDATIONS[validation._tag];
    if (generator) {
      result += generator(validation);
    }
  }

  return result;
}

// Number validation strategies
const NUMBER_VALIDATIONS: Record<
  string,
  (val: import("~/domain/zod-ast").NumberValidation) => string
> = {
  Min: (v) => `.min(${(v as { value: number }).value})`,
  Max: (v) => `.max(${(v as { value: number }).value})`,
  Gt: (v) => `.gt(${(v as { value: number }).value})`,
  Gte: (v) => `.gte(${(v as { value: number }).value})`,
  Lt: (v) => `.lt(${(v as { value: number }).value})`,
  Lte: (v) => `.lte(${(v as { value: number }).value})`,
  Int: () => ".int()",
  Positive: () => ".positive()",
  Nonnegative: () => ".nonnegative()",
  Negative: () => ".negative()",
  Nonpositive: () => ".nonpositive()",
  MultipleOf: (v) => `.multipleOf(${(v as { value: number }).value})`,
  Step: (v) => `.step(${(v as { value: number }).value})`,
  Finite: () => ".finite()",
  Safe: () => ".safe()",
};

// Generate number type with validations
function generateNumberType(
  validations: ReadonlyArray<import("~/domain/zod-ast").NumberValidation>
): string {
  let result = "z.number()";

  for (const validation of validations) {
    const generator = NUMBER_VALIDATIONS[validation._tag];
    if (generator) {
      result += generator(validation);
    }
  }

  return result;
}

// Generate import statements
function generateImports(): string {
  return `import { z } from "zod";`;
}

// Generate Zod enum
function generateEnum(zodEnum: ZodEnum): string {
  // Generate array of string literals for z.enum()
  const enumValues = zodEnum.values.map((v) => `"${v}"`).join(", ");

  const lines = [];

  if (zodEnum.documentation) {
    lines.push(`// ${zodEnum.documentation}`);
  }

  lines.push(
    `export const ${zodEnum.name}Schema = z.enum([${enumValues}]);`,
    ``,
    `// Type inference from schema: ${zodEnum.name}`,
    `export type ${zodEnum.name} = z.infer<typeof ${zodEnum.name}Schema>;`
  );

  return lines.join("\n");
}

// Generate Zod object
function generateObject(zodObject: ZodObject): string {
  const fields = zodObject.fields
    .map((field) => `  ${field.name}: ${generateType(field.type)}`)
    .join(",\n");

  const lines = [];

  if (zodObject.documentation) {
    lines.push(`// ${zodObject.documentation}`);
  }

  lines.push(
    `export const ${zodObject.name}Schema = z.object({`,
    fields,
    `});`,
    ``,
    `// Type inference from schema: ${zodObject.name}`,
    `export type ${zodObject.name} = z.infer<typeof ${zodObject.name}Schema>;`
  );

  return lines.join("\n");
}

// Generate TypeScript code from Zod schema
function generateCode(schema: ZodSchema): string {
  const imports = generateImports();
  const enums = schema.enums.map(generateEnum).join("\n\n");
  const objects = schema.objects.map(generateObject).join("\n\n");

  return [imports, enums, objects].filter(Boolean).join("\n\n");
}

// Zod code generator
export const ZodGeneratorLive = Layer.succeed(
  ZodGenerator,
  ZodGenerator.of({
    generate: (schema: ZodSchema) =>
      Effect.try({
        try: () => {
          // Validate input using Zod
          const validSchema = InputValidationSchema.parse(schema);
          return generateCode(validSchema as unknown as ZodSchema);
        },
        catch: (error) =>
          new ValidationError({
            field: "schema",
            value: schema,
            expected: "Valid ZodSchema",
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof Error && { cause: error }),
          }),
      }),

    format: (code: string) =>
      Effect.tryPromise({
        try: async () => {
          const prettier = await import("prettier");
          return prettier.format(code, { parser: "typescript" });
        },
        catch: (error) =>
          new CodeGenerationError({
            modelName: "Global",
            reason: error instanceof Error ? error.message : String(error),
            ...(error instanceof Error && { cause: error }),
          }),
      }),
  })
);
