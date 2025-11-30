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
  typeName: string;
  value?: string | number | boolean;
  checks?: ReadonlyArray<{
    kind: string;
    value?: number | string;
    regex?: RegExp;
    inclusive?: boolean;
  }>;
  innerType?: z.ZodTypeAny;
  type?: z.ZodTypeAny;
  keyType?: z.ZodTypeAny;
  valueType?: z.ZodTypeAny;
  items?: ReadonlyArray<z.ZodTypeAny>;
  options?: ReadonlyArray<z.ZodTypeAny>;
  defaultValue?: () => unknown;
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
    if (schema instanceof z.ZodObject) {
      objects.push(parseZodObject(name, schema, registry));
    } else if (def.typeName === "ZodNativeEnum" || def.typeName === ZOD_TAGS.ZodEnum) {
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
  const def = schema._def as unknown as ZodTypeDef & { values?: unknown[]; enum?: Record<string, unknown> };
  const enumObj = def.enum || {};
  const values = Object.values(enumObj).filter((v) => typeof v === "string") as string[];
  return {
    name,
    values,
    ...(schema.description !== undefined && { documentation: schema.description }),
  };
}

function parseZodType(schema: z.ZodTypeAny, registry: Map<z.ZodTypeAny, string>): ZodType {
  const registeredName = registry.get(schema);
  if (registeredName) {
    const def = schema._def as unknown as ZodTypeDef;
    if (def.typeName === "ZodNativeEnum" || def.typeName === ZOD_TAGS.ZodEnum) {
      return { _tag: ZOD_TAGS.ZodEnum, name: registeredName };
    }
    if (def.typeName === ZOD_TAGS.ZodObject) {
      return { _tag: ZOD_TAGS.ZodObject, name: registeredName };
    }
  }

  const def = schema._def as unknown as ZodTypeDef;

  switch (def.typeName) {
    case ZOD_TAGS.ZodString:
      return {
        _tag: ZOD_TAGS.ZodString,
        validations: parseStringValidations(def),
      };
    case ZOD_TAGS.ZodNumber:
      return {
        _tag: ZOD_TAGS.ZodNumber,
        validations: parseNumberValidations(def),
      };
    case ZOD_TAGS.ZodBoolean:
      return { _tag: ZOD_TAGS.ZodBoolean };
    case ZOD_TAGS.ZodDate:
      return { _tag: ZOD_TAGS.ZodDate };
    case ZOD_TAGS.ZodBigInt:
      return { _tag: ZOD_TAGS.ZodBigInt };
    case ZOD_TAGS.ZodLiteral:
      return { _tag: ZOD_TAGS.ZodLiteral, value: def.value! };
    case ZOD_TAGS.ZodArray:
      return { _tag: ZOD_TAGS.ZodArray, element: parseZodType(def.type!, registry) };
    case ZOD_TAGS.ZodTuple:
      return {
        _tag: ZOD_TAGS.ZodTuple,
        items: (def.items || []).map((i) => parseZodType(i, registry)),
      };
    case ZOD_TAGS.ZodUnion:
      return {
        _tag: ZOD_TAGS.ZodUnion,
        options: (def.options || []).map((o) => parseZodType(o, registry)),
      };
    case ZOD_TAGS.ZodRecord:
      return {
        _tag: ZOD_TAGS.ZodRecord,
        keyType: parseZodType(def.keyType!, registry),
        valueType: parseZodType(def.valueType!, registry),
      };
    case ZOD_TAGS.ZodObject:
      return { _tag: ZOD_TAGS.ZodObject, name: "Nested" };
    case "ZodNativeEnum":
      return { _tag: ZOD_TAGS.ZodEnum, name: "UnknownEnum" };
    case ZOD_TAGS.ZodOptional:
      return { _tag: ZOD_TAGS.ZodOptional, inner: parseZodType(def.innerType!, registry) };
    case ZOD_TAGS.ZodNullable:
      return { _tag: ZOD_TAGS.ZodNullable, inner: parseZodType(def.innerType!, registry) };
    case ZOD_TAGS.ZodDefault:
      return {
        _tag: ZOD_TAGS.ZodDefault,
        inner: parseZodType(def.innerType!, registry),
        defaultValue: def.defaultValue ? def.defaultValue() : undefined,
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
    }
  }
  return validations;
}
