/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { ZOD_TAGS, ZOD_VALIDATIONS, PRISMA_TAGS, PRISMA_TYPES } from "~/domain/constants";
import type { ZodType } from "~/domain/zod-ast";
import type { PrismaFieldType } from "~/domain/prisma-ast";

type TypeMapper = (zodType: any) => PrismaFieldType;

const mapType = (zodType: ZodType): PrismaFieldType => {
  const mappers: Record<string, TypeMapper> = {
    [ZOD_TAGS.ZodString]: () => PRISMA_TYPES.String,
    [ZOD_TAGS.ZodBoolean]: () => PRISMA_TYPES.Boolean,
    [ZOD_TAGS.ZodDate]: () => PRISMA_TYPES.DateTime,
    [ZOD_TAGS.ZodBigInt]: () => PRISMA_TYPES.BigInt,
    [ZOD_TAGS.ZodUnknown]: () => PRISMA_TYPES.Json,
    [ZOD_TAGS.ZodNull]: () => PRISMA_TYPES.Json,
    [ZOD_TAGS.ZodUndefined]: () => PRISMA_TYPES.Json,
    [ZOD_TAGS.ZodNaN]: () => PRISMA_TYPES.Json,
    [ZOD_TAGS.ZodTuple]: () => PRISMA_TYPES.Json,
    [ZOD_TAGS.ZodRecord]: () => PRISMA_TYPES.Json,
    [ZOD_TAGS.ZodUnion]: (t) => t.options?.[0] ? mapType(t.options[0]) : PRISMA_TYPES.Json,

    [ZOD_TAGS.ZodNumber]: (t) => {
      const hasIntValidation = t.validations?.some((v: any) => v._tag === ZOD_VALIDATIONS.Int);
      return hasIntValidation ? PRISMA_TYPES.Int : PRISMA_TYPES.Float;
    },

    [ZOD_TAGS.ZodLiteral]: (t) => {
      if (typeof t.value === "string") return PRISMA_TYPES.String;
      if (typeof t.value === "number") return PRISMA_TYPES.Float;
      if (typeof t.value === "boolean") return PRISMA_TYPES.Boolean;
      return PRISMA_TYPES.String;
    },

    [ZOD_TAGS.ZodEnum]: (t) => ({ _tag: PRISMA_TAGS.Enum, name: t.name }),
    [ZOD_TAGS.ZodObject]: (t) => ({ _tag: PRISMA_TAGS.Model, name: t.name }),

    // Unwrap wrappers
    [ZOD_TAGS.ZodArray]: (t) => mapType(t.element),
    [ZOD_TAGS.ZodOptional]: (t) => mapType(t.inner),
    [ZOD_TAGS.ZodNullable]: (t) => mapType(t.inner),
    [ZOD_TAGS.ZodDefault]: (t) => mapType(t.inner),
  };

  const mapper = mappers[zodType._tag];
  return mapper ? mapper(zodType) : PRISMA_TYPES.String;
};

export function createPrismaType(zodType: ZodType): PrismaFieldType {
  return mapType(zodType);
}
