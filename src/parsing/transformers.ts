/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import type {
  PrismaSchema,
  PrismaModel,
  PrismaField,
  PrismaFieldType,
  PrismaEnum,
  PrismaFieldAttribute,
} from "~/domain/prisma-ast";
import type {
  ZodSchema,
  ZodObject,
  ZodField,
  ZodType,
  ZodEnum,
} from "~/domain/zod-ast";
import {
  ZOD_TAGS,
  ZOD_VALIDATIONS,
  PRISMA_TAGS,
  PRISMA_TYPES,
} from "./constants";

// Map Prisma type to Zod type
const PRISMA_TO_ZOD_MAP: Record<string, ZodType> = {
  [PRISMA_TYPES.String]: { _tag: ZOD_TAGS.ZodString, validations: [] },
  [PRISMA_TYPES.Int]: { _tag: ZOD_TAGS.ZodNumber, validations: [{ _tag: ZOD_VALIDATIONS.Int }] },
  [PRISMA_TYPES.BigInt]: { _tag: ZOD_TAGS.ZodBigInt },
  [PRISMA_TYPES.Float]: { _tag: ZOD_TAGS.ZodNumber, validations: [] },
  [PRISMA_TYPES.Decimal]: { _tag: ZOD_TAGS.ZodNumber, validations: [] },
  [PRISMA_TYPES.Boolean]: { _tag: ZOD_TAGS.ZodBoolean },
  [PRISMA_TYPES.DateTime]: { _tag: ZOD_TAGS.ZodDate },
  [PRISMA_TYPES.Json]: { _tag: ZOD_TAGS.ZodUnknown },
  [PRISMA_TYPES.Bytes]: { _tag: ZOD_TAGS.ZodUnknown },
};

function prismaTypeToZodType(prismaType: PrismaFieldType): ZodType {
  if (typeof prismaType === "string") {
    return PRISMA_TO_ZOD_MAP[prismaType] || { _tag: ZOD_TAGS.ZodUnknown };
  }

  if (prismaType._tag === PRISMA_TAGS.Enum) {
    return { _tag: ZOD_TAGS.ZodEnum, name: prismaType.name };
  }

  return { _tag: ZOD_TAGS.ZodObject, name: prismaType.name };
}

function isRelationField(field: PrismaField): boolean {
  return field.attributes.some((attr) => attr._tag === PRISMA_TAGS.Relation);
}

function fieldToZodField(field: PrismaField): ZodField {
  let type = prismaTypeToZodType(field.type);

  if (field.modifiers.isList) {
    type = { _tag: ZOD_TAGS.ZodArray, element: type };
  }

  const hasDefault = field.attributes.some((attr) => attr._tag === PRISMA_TAGS.Default);
  if (field.modifiers.isOptional && !hasDefault) {
    type = { _tag: ZOD_TAGS.ZodOptional, inner: type };
  }

  if (hasDefault) {
    const defaultAttr = field.attributes.find(
      (a) => a._tag === PRISMA_TAGS.Default
    ) as Extract<
      import("~/domain/prisma-ast").PrismaFieldAttribute,
      { _tag: "Default" }
    >;

    const defaultValue =
      defaultAttr.value._tag === PRISMA_TAGS.Literal
        ? defaultAttr.value.value
        : undefined; // Functions like autoincrement, now, uuid will be handled in code generation

    type = {
      _tag: ZOD_TAGS.ZodDefault,
      inner: type,
      defaultValue,
    };
  }

  return {
    name: field.name,
    type,
    ...(field.documentation !== undefined && {
      documentation: field.documentation,
    }),
  };
}

function modelToZodObject(model: PrismaModel): ZodObject {
  return {
    name: model.name,
    fields: model.fields
      .filter((field) => !isRelationField(field))
      .filter((field) => !field.attributes.some((attr) => attr._tag === PRISMA_TAGS.Ignore)) // Exclude @ignore fields
      .map((field) => fieldToZodField(field)),
    ...(model.documentation !== undefined && {
      documentation: model.documentation,
    }),
  };
}

function enumToZodEnum(prismaEnum: PrismaEnum): ZodEnum {
  return {
    name: prismaEnum.name,
    values: prismaEnum.values,
    ...(prismaEnum.documentation !== undefined && {
      documentation: prismaEnum.documentation,
    }),
  };
}

export function prismaToZod(prisma: PrismaSchema): ZodSchema {
  return {
    objects: prisma.models
      .filter((model) => !model.attributes.some((attr) => attr._tag === PRISMA_TAGS.Ignore)) // Exclude @@ignore models
      .map(modelToZodObject),
    enums: prisma.enums.map(enumToZodEnum),
  };
}



import { createPrismaType } from "./factories/type-mapping-factory";

function zodTypeToPrismaType(zodType: ZodType): PrismaFieldType {
  return createPrismaType(zodType);
}

function zodFieldToPrismaField(field: ZodField): PrismaField {
  const attributes: PrismaFieldAttribute[] = [];
  let type = field.type;
  let isList = false;
  let isOptional = false;

  while (
    type._tag === ZOD_TAGS.ZodOptional ||
    type._tag === ZOD_TAGS.ZodNullable ||
    type._tag === ZOD_TAGS.ZodArray ||
    type._tag === ZOD_TAGS.ZodDefault
  ) {
    if (type._tag === ZOD_TAGS.ZodOptional) {
      isOptional = true;
      type = type.inner;
    } else if (type._tag === ZOD_TAGS.ZodNullable) {
      isOptional = true;
      type = type.inner;
    } else if (type._tag === ZOD_TAGS.ZodArray) {
      isList = true;
      type = type.element;
    } else if (type._tag === ZOD_TAGS.ZodDefault) {
      if (
        type.defaultValue !== undefined &&
        type.defaultValue !== null &&
        (typeof type.defaultValue === "string" ||
          typeof type.defaultValue === "number" ||
          typeof type.defaultValue === "boolean")
      ) {
        attributes.push({
          _tag: PRISMA_TAGS.Default,
          value: { _tag: PRISMA_TAGS.Literal, value: type.defaultValue },
        });
      }

      type = type.inner;
    }
  }




  // Infer @id from field name 'id' or documentation
  if (field.name === "id" || field.documentation?.includes("@id")) {
    attributes.push({ _tag: PRISMA_TAGS.Id });
    // If it's a string ID, it often has a default
    if (type._tag === ZOD_TAGS.ZodString) {
      if (type.validations.some(v => v._tag === ZOD_VALIDATIONS.Cuid)) {
        attributes.push({ _tag: PRISMA_TAGS.Default, value: { _tag: PRISMA_TAGS.Cuid } });
      } else if (type.validations.some(v => v._tag === ZOD_VALIDATIONS.Uuid)) {
        attributes.push({ _tag: PRISMA_TAGS.Default, value: { _tag: PRISMA_TAGS.Uuid } });
      }
    }
    // If it's an Int ID, it often is autoincrement
    if (type._tag === ZOD_TAGS.ZodNumber && type.validations.some(v => v._tag === ZOD_VALIDATIONS.Int)) {
      attributes.push({ _tag: PRISMA_TAGS.Default, value: { _tag: PRISMA_TAGS.AutoIncrement } });
    }
  }

  // Infer @default(now()) for 'createdAt'
  if (field.name === "createdAt" && type._tag === ZOD_TAGS.ZodDate) {
    attributes.push({ _tag: PRISMA_TAGS.Default, value: { _tag: PRISMA_TAGS.Now } });
  }

  // Infer @updatedAt for 'updatedAt'
  if (field.name === "updatedAt" && type._tag === ZOD_TAGS.ZodDate) {
    attributes.push({ _tag: PRISMA_TAGS.UpdatedAt });
  }

  // Infer @unique from documentation
  if (field.documentation?.includes("@unique") && !attributes.some(a => a._tag === PRISMA_TAGS.Unique)) {
    attributes.push({ _tag: PRISMA_TAGS.Unique });
  }

  return {
    name: field.name,
    type: zodTypeToPrismaType(field.type),
    modifiers: {
      isList,
      isOptional,
      isUnique: field.documentation?.includes("@unique") ?? false,
    },
    attributes,
    ...(field.documentation && { documentation: field.documentation }),
  };
}

function zodObjectToPrismaModel(obj: ZodObject): PrismaModel {
  return {
    name: obj.name,
    fields: obj.fields.map(zodFieldToPrismaField),
    attributes: [],
    ...(obj.documentation && { documentation: obj.documentation }),
  };
}

function zodEnumToPrismaEnum(zEnum: ZodEnum): PrismaEnum {
  return {
    name: zEnum.name,
    values: zEnum.values,
    ...(zEnum.documentation && { documentation: zEnum.documentation }),
  };
}

export function zodToPrisma(zod: ZodSchema): PrismaSchema {
  return {
    models: zod.objects.map(zodObjectToPrismaModel),
    enums: zod.enums.map(zodEnumToPrismaEnum),
  };
}
