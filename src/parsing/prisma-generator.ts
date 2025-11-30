/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Context, Layer } from "effect";
import type {
  PrismaSchema,
  PrismaModel,
  PrismaField,
  PrismaFieldType,
  PrismaEnum,
  PrismaFieldAttribute,
} from "~/domain/prisma-ast";

export interface PrismaGenerator {
  readonly generate: (schema: PrismaSchema) => Effect.Effect<string, never, never>;
}

export const PrismaGenerator = Context.GenericTag<PrismaGenerator>("@app/PrismaGenerator");

import { createAttribute } from "./factories/attribute-factory";

const generateAttribute = (attr: PrismaFieldAttribute, fieldType: PrismaFieldType): string => {
  return createAttribute(attr, fieldType);
};

const generateField = (field: PrismaField): string => {
  let typeStr = "";
  if (typeof field.type === "string") {
    typeStr = field.type;
  } else {
    typeStr = field.type.name;
  }

  const modifiers = [];
  if (field.modifiers.isList) modifiers.push("[]");
  else if (field.modifiers.isOptional) modifiers.push("?");

  const attributes = field.attributes.map(attr => generateAttribute(attr, field.type)).join(" ");

  return `  ${field.name} ${typeStr}${modifiers.join("")} ${attributes}`;
};

const generateModel = (model: PrismaModel): string => {
  const fields = model.fields.map(generateField).join("\n");
  return `model ${model.name} {\n${fields}\n}`;
};

const generateEnum = (enumDef: PrismaEnum): string => {
  const values = enumDef.values.map((v) => `  ${v}`).join("\n");
  return `enum ${enumDef.name} {\n${values}\n}`;
};

export const PrismaGeneratorLive = Layer.succeed(
  PrismaGenerator,
  PrismaGenerator.of({
    generate: (schema: PrismaSchema) =>
      Effect.sync(() => {
        const enums = schema.enums.map(generateEnum).join("\n\n");
        const models = schema.models.map(generateModel).join("\n\n");

        const parts = [];
        if (enums) parts.push(enums);
        if (models) parts.push(models);

        return parts.join("\n\n");
      }),
  })
);
