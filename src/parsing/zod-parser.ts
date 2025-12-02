/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { z } from "zod";
import type {
  ZodSchema,
  ZodObject,
  ZodField,
  ZodType,
  ZodEnum,
  StringValidation,
  NumberValidation,
} from "~/domain/zod-ast";
import { ZOD_TAGS, ZOD_VALIDATIONS, ZOD_CHECKS } from "./constants";

type ZodTypeDef = {
  typeName?: string;  // Zod v3
  type?: string;      // Zod v4 Standard Schema type identifier
  value?: string | number | boolean;
  checks?: ReadonlyArray<{
    kind: string;
    value?: number | string;
    regex?: RegExp;
    inclusive?: boolean;
  }>;
  innerType?: z.ZodTypeAny;
  element?: z.ZodTypeAny;  // For wrapped types like arrays
  shape?: Record<string, z.ZodTypeAny>;  // For objects
  keyType?: z.ZodTypeAny;
  valueType?: z.ZodTypeAny;
  items?: ReadonlyArray<z.ZodTypeAny>;
  options?: ReadonlyArray<z.ZodTypeAny>;
  defaultValue?: () => unknown;
  values?: unknown[];
  enum?: Record<string, unknown>;
};

export function parseZodSchema(schemas: Record<string, z.ZodTypeAny>): ZodSchema {
  const objects: ZodObject[] = [];
  const enums: ZodEnum[] = [];
  const registry = new Map<z.ZodTypeAny, string>();

  for (const [name, schema] of Object.entries(schemas)) {
    registry.set(schema, name);
  }

  for (const [name, schema] of Object.entries(schemas)) {
    const def = schema._def as unknown as ZodTypeDef;
    const typeIdentifier = def.typeName || def.type;

    if (schema instanceof z.ZodObject) {
      objects.push(parseZodObject(name, schema, registry));
    } else if (typeIdentifier === "enum" || typeIdentifier === "ZodNativeEnum" || typeIdentifier === ZOD_TAGS.ZodEnum) {
      enums.push(parseZodEnum(name, schema));
    }
  }

  return { objects, enums };
}

function parseZodObject(
  name: string,
  schema: z.ZodObject<any>,
  registry: Map<z.ZodTypeAny, string>
): ZodObject {
  const fields: ZodField[] = [];
  const shape = schema.shape;

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const zodSchema = fieldSchema as z.ZodTypeAny;
    const doc = (zodSchema as { description?: string }).description;
    fields.push({
      name: fieldName,
      type: parseZodType(zodSchema, registry),
      ...(doc !== undefined && { documentation: doc }),
    });
  }

  return {
    name,
    fields,
    ...(schema.description !== undefined && { documentation: schema.description }),
  };
}

function parseZodEnum(name: string, schema: z.ZodTypeAny): ZodEnum {
  const def = schema._def as unknown as ZodTypeDef;

  // Zod v4 uses _def.values (array) or _def.entries (object)
  if (def.values && Array.isArray(def.values)) {
    return {
      name,
      values: def.values as string[],
      ...(schema.description !== undefined && { documentation: schema.description }),
    };
  }

  if ((def as any).entries) {
    return {
      name,
      values: Object.keys((def as any).entries),
      ...(schema.description !== undefined && { documentation: schema.description }),
    };
  }

  // Zod v3 uses _def.enum
  const enumObj = def.enum || {};
  const values = Object.values(enumObj).filter((v) => typeof v === "string") as string[];
  return {
    name,
    values,
    ...(schema.description !== undefined && { documentation: schema.description }),
  };
}

function parseZodType(schema: z.ZodTypeAny, registry: Map<z.ZodTypeAny, string>): ZodType {
  // Handle null/undefined schemas
  if (!schema) {
    return { _tag: ZOD_TAGS.ZodUnknown };
  }

  const registeredName = registry.get(schema);
  const def = schema._def as unknown as ZodTypeDef;

  // Handle lazy schemas - unwrap them first
  const typeIdentifier = def.typeName || def.type;
  if (typeIdentifier === "lazy" || typeIdentifier === ZOD_TAGS.ZodLazy) {
    // For lazy schemas, we need to get the getter function and call it
    const getter = (def as any).getter;
    if (getter && typeof getter === "function") {
      try {
        const unwrapped = getter();
        return parseZodType(unwrapped, registry);
      } catch (e) {
        // If we can't unwrap, treat as unknown
        return { _tag: ZOD_TAGS.ZodUnknown };
      }
    }
    return { _tag: ZOD_TAGS.ZodUnknown };
  }

  if (registeredName) {
    if (typeIdentifier === "enum" || typeIdentifier === "ZodNativeEnum" || typeIdentifier === ZOD_TAGS.ZodEnum) {
      return { _tag: ZOD_TAGS.ZodEnum, name: registeredName };
    }
    if (typeIdentifier === "object" || typeIdentifier === ZOD_TAGS.ZodObject) {
      return { _tag: ZOD_TAGS.ZodObject, name: registeredName };
    }
  }

  switch (typeIdentifier) {
    case "string":
    case ZOD_TAGS.ZodString:
      return {
        _tag: ZOD_TAGS.ZodString,
        validations: parseStringValidations(def),
      };
    case "number":
    case ZOD_TAGS.ZodNumber:
      return {
        _tag: ZOD_TAGS.ZodNumber,
        validations: parseNumberValidations(def),
      };
    case "boolean":
    case ZOD_TAGS.ZodBoolean:
      return { _tag: ZOD_TAGS.ZodBoolean };
    case "date":
    case ZOD_TAGS.ZodDate:
      return { _tag: ZOD_TAGS.ZodDate };
    case "bigint":
    case ZOD_TAGS.ZodBigInt:
      return { _tag: ZOD_TAGS.ZodBigInt };
    case "literal":
    case ZOD_TAGS.ZodLiteral:
      return { _tag: ZOD_TAGS.ZodLiteral, value: def.value! };
    case "array":
    case ZOD_TAGS.ZodArray:
      // Zod v4 uses _def.type for the element type
      const elementType = (def as any).element || def.type;
      return { _tag: ZOD_TAGS.ZodArray, element: parseZodType(elementType!, registry) };
    case "tuple":
    case ZOD_TAGS.ZodTuple:
      return {
        _tag: ZOD_TAGS.ZodTuple,
        items: (def.items || []).map((i) => parseZodType(i, registry)),
      };
    case "union":
    case ZOD_TAGS.ZodUnion:
      return {
        _tag: ZOD_TAGS.ZodUnion,
        options: (def.options || []).map((o) => parseZodType(o, registry)),
      };
    case "record":
    case ZOD_TAGS.ZodRecord:
      return {
        _tag: ZOD_TAGS.ZodRecord,
        keyType: parseZodType(def.keyType!, registry),
        valueType: parseZodType(def.valueType!, registry),
      };
    case "object":
    case ZOD_TAGS.ZodObject:
      return { _tag: ZOD_TAGS.ZodObject, name: "Nested" };
    case "enum":
    case "ZodNativeEnum":
      return { _tag: ZOD_TAGS.ZodEnum, name: "UnknownEnum" };
    case "optional":
    case ZOD_TAGS.ZodOptional:
      const optionalInner = (def as any).innerType || (def as any).unwrap;
      return { _tag: ZOD_TAGS.ZodOptional, inner: parseZodType(optionalInner!, registry) };
    case "nullable":
    case ZOD_TAGS.ZodNullable:
      const nullableInner = (def as any).innerType || (def as any).unwrap;
      return { _tag: ZOD_TAGS.ZodNullable, inner: parseZodType(nullableInner!, registry) };
    case "default":
    case ZOD_TAGS.ZodDefault:
      const defaultInner = (def as any).innerType || (def as any).innerSchema;
      const defaultVal = def.defaultValue;
      return {
        _tag: ZOD_TAGS.ZodDefault,
        inner: parseZodType(defaultInner!, registry),
        defaultValue: typeof defaultVal === "function" ? defaultVal() : defaultVal,
      };
    default:
      return { _tag: ZOD_TAGS.ZodUnknown };
  }
}

function parseStringValidations(def: ZodTypeDef): StringValidation[] {
  const validations: StringValidation[] = [];
  if (!def.checks) return validations;

  for (const check of def.checks) {
    switch (check.kind) {
      case ZOD_CHECKS.min:
        if (check.value !== undefined) {
          validations.push({ _tag: ZOD_VALIDATIONS.MinLength, value: check.value as number });
        }
        break;
      case ZOD_CHECKS.max:
        if (check.value !== undefined) {
          validations.push({ _tag: ZOD_VALIDATIONS.MaxLength, value: check.value as number });
        }
        break;
      case ZOD_CHECKS.email:
        validations.push({ _tag: ZOD_VALIDATIONS.Email });
        break;
      case ZOD_CHECKS.url:
        validations.push({ _tag: ZOD_VALIDATIONS.Url });
        break;
      case ZOD_CHECKS.uuid:
        validations.push({ _tag: ZOD_VALIDATIONS.Uuid });
        break;
      case ZOD_CHECKS.cuid:
        validations.push({ _tag: ZOD_VALIDATIONS.Cuid });
        break;
      case ZOD_CHECKS.cuid2:
        validations.push({ _tag: ZOD_VALIDATIONS.Cuid2 });
        break;
      case ZOD_CHECKS.ulid:
        validations.push({ _tag: ZOD_VALIDATIONS.Ulid });
        break;
      case ZOD_CHECKS.nanoid:
        validations.push({ _tag: ZOD_VALIDATIONS.Nanoid });
        break;
      case ZOD_CHECKS.emoji:
        validations.push({ _tag: ZOD_VALIDATIONS.Emoji });
        break;
      case ZOD_CHECKS.regex:
        if (check.regex) {
          validations.push({ _tag: ZOD_VALIDATIONS.Regex, pattern: check.regex.source });
        }
        break;
      case ZOD_CHECKS.includes:
        if (check.value !== undefined) {
          validations.push({ _tag: ZOD_VALIDATIONS.Includes, value: check.value as string });
        }
        break;
      case ZOD_CHECKS.startsWith:
        if (check.value !== undefined) {
          validations.push({ _tag: ZOD_VALIDATIONS.StartsWith, value: check.value as string });
        }
        break;
      case ZOD_CHECKS.endsWith:
        if (check.value !== undefined) {
          validations.push({ _tag: ZOD_VALIDATIONS.EndsWith, value: check.value as string });
        }
        break;
    }
  }
  return validations;
}

function parseNumberValidations(def: ZodTypeDef): NumberValidation[] {
  const validations: NumberValidation[] = [];
  if (!def.checks) return validations;

  for (const check of def.checks) {
    switch (check.kind) {
      case ZOD_CHECKS.min:
        if (check.value !== undefined) {
          validations.push({
            _tag: check.inclusive ? ZOD_VALIDATIONS.Gte : ZOD_VALIDATIONS.Gt,
            value: check.value as number,
          });
        }
        break;
      case ZOD_CHECKS.max:
        if (check.value !== undefined) {
          validations.push({
            _tag: check.inclusive ? ZOD_VALIDATIONS.Lte : ZOD_VALIDATIONS.Lt,
            value: check.value as number,
          });
        }
        break;
      case ZOD_CHECKS.int:
        validations.push({ _tag: ZOD_VALIDATIONS.Int });
        break;
      case ZOD_CHECKS.multipleOf:
        if (check.value !== undefined) {
          validations.push({ _tag: ZOD_VALIDATIONS.MultipleOf, value: check.value as number });
        }
        break;
      case ZOD_CHECKS.finite:
        validations.push({ _tag: ZOD_VALIDATIONS.Finite });
        break;
      default:
        if ((check as any).kind === "int" || (check as any).isInt === true) {
          validations.push({ _tag: ZOD_VALIDATIONS.Int });
        }
        break;
    }
  }
  return validations;
}
