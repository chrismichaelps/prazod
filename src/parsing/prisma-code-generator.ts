/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import type {
  PrismaSchema,
  PrismaModel,
  PrismaFieldType,
  PrismaEnum,
  PrismaDefaultValue,
  PrismaFieldAttribute,
  PrismaModelAttribute,
} from "~/domain/prisma-ast";
import { PRISMA_TAGS } from "./constants";

function generateDefaultValue(defaultValue: PrismaDefaultValue, fieldType?: PrismaFieldType): string {
  switch (defaultValue._tag) {
    case PRISMA_TAGS.Literal:
      if (typeof defaultValue.value === "string") {
        // If it's an enum type, don't quote the value
        if (fieldType && typeof fieldType === "object" && fieldType._tag === PRISMA_TAGS.Enum) {
          return defaultValue.value;
        }
        return `"${defaultValue.value}"`;
      }
      return String(defaultValue.value);
    case PRISMA_TAGS.AutoIncrement:
      return "autoincrement()";
    case PRISMA_TAGS.Auto:
      return "auto()";
    case PRISMA_TAGS.Now:
      return "now()";
    case PRISMA_TAGS.Uuid:
      return "uuid()";
    case PRISMA_TAGS.Cuid:
      return "cuid()";
    case PRISMA_TAGS.Ulid:
      return "ulid()";
    case PRISMA_TAGS.Nanoid:
      return defaultValue.length
        ? `nanoid(${defaultValue.length})`
        : "nanoid()";
    case PRISMA_TAGS.Sequence:
      if (defaultValue.options) {
        const opts = Object.entries(defaultValue.options)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        return `sequence(${opts})`;
      }
      return "sequence()";
    case PRISMA_TAGS.DbGenerated:
      return defaultValue.expression
        ? `dbgenerated("${defaultValue.expression}")`
        : "dbgenerated()";
    default:
      return "autoincrement()";
  }
}

function generateFieldAttribute(attr: PrismaFieldAttribute, fieldType?: PrismaFieldType): string {
  switch (attr._tag) {
    case PRISMA_TAGS.Id:
      return "@id";
    case PRISMA_TAGS.Unique:
      return "@unique";
    case PRISMA_TAGS.UpdatedAt:
      return "@updatedAt";
    case PRISMA_TAGS.Ignore:
      return "@ignore";
    case PRISMA_TAGS.Map:
      return `@map("${attr.name}")`;
    case PRISMA_TAGS.Default:
      return `@default(${generateDefaultValue(attr.value, fieldType)})`;
    case PRISMA_TAGS.Relation:
      const parts: string[] = [];

      // Relation name comes first if it exists
      if (attr.relation.name) {
        parts.push(`"${attr.relation.name}"`);
      }

      if (attr.relation.fields.length > 0) {
        parts.push(
          `fields: [${attr.relation.fields.join(", ")}]`
        );
      }
      if (attr.relation.references.length > 0) {
        parts.push(
          `references: [${attr.relation.references.join(", ")}]`
        );
      }
      if (attr.relation.onDelete) {
        parts.push(`onDelete: ${attr.relation.onDelete}`);
      }
      if (attr.relation.onUpdate) {
        parts.push(`onUpdate: ${attr.relation.onUpdate}`);
      }
      if (attr.relation.map) {
        parts.push(`map: "${attr.relation.map}"`);
      }
      return parts.length > 0 ? `@relation(${parts.join(", ")})` : "@relation";
    case PRISMA_TAGS.Native:
      return attr.value;
    default:
      return "";
  }
}

function generateFieldType(fieldType: PrismaFieldType): string {
  if (typeof fieldType === "object") {
    return fieldType.name;
  }
  return fieldType;
}


function generateModelAttribute(attr: PrismaModelAttribute): string {
  switch (attr._tag) {
    case PRISMA_TAGS.Id:
      return `@@id([${attr.fields.join(", ")}])`;
    case PRISMA_TAGS.Unique:
      return attr.name
        ? `@@unique([${attr.fields.join(", ")}], name: "${attr.name}")`
        : `@@unique([${attr.fields.join(", ")}])`;
    case PRISMA_TAGS.Index:
      return attr.name
        ? `@@index([${attr.fields.join(", ")}], name: "${attr.name}")`
        : `@@index([${attr.fields.join(", ")}])`;
    case PRISMA_TAGS.FullText:
      const fullTextParts = [`[${attr.fields.join(", ")}]`];
      if (attr.map) fullTextParts.push(`map: "${attr.map}"`);
      return `@@fulltext(${fullTextParts.join(", ")})`;
    case PRISMA_TAGS.Map:
      return `@@map("${attr.name}")`;
    case PRISMA_TAGS.Schema:
      return `@@schema("${attr.name}")`;
    case PRISMA_TAGS.Ignore:
      return "@@ignore";
    default:
      return "";
  }
}

function generateModel(model: PrismaModel): string {
  const lines: string[] = [];

  if (model.documentation) {
    const docLines = model.documentation.split("\n");
    for (const line of docLines) {
      lines.push(`/// ${line}`);
    }
  }

  lines.push(`model ${model.name} {`);

  // Calculate max widths for this model (like Prisma formatter does)
  let maxNameWidth = 0;
  let maxTypeWidth = 0;

  for (const field of model.fields) {
    maxNameWidth = Math.max(maxNameWidth, field.name.length);
    const typeStr = generateFieldType(field.type);
    const modifiers = field.modifiers.isList ? "[]" : field.modifiers.isOptional ? "?" : "";
    maxTypeWidth = Math.max(maxTypeWidth, (typeStr + modifiers).length);
  }

  // Add 1 space padding after longest name, align types
  const nameWidth = maxNameWidth + 1;
  const typeWidth = maxTypeWidth + 1;

  for (const field of model.fields) {
    const typeStr = generateFieldType(field.type);
    const modifiers = field.modifiers.isList
      ? "[]"
      : field.modifiers.isOptional
        ? "?"
        : "";

    const attributes = field.attributes
      .map((attr) => generateFieldAttribute(attr, field.type))
      .filter(Boolean)
      .join(" ");

    const paddedName = field.name.padEnd(nameWidth);
    const paddedType = (typeStr + modifiers).padEnd(typeWidth);

    lines.push(`  ${paddedName} ${paddedType} ${attributes}`.trimEnd());
  }

  if (model.attributes.length > 0) {
    lines.push("");
    for (const attr of model.attributes) {
      const attrStr = generateModelAttribute(attr);
      if (attrStr) {
        lines.push(`  ${attrStr}`);
      }
    }
  }

  lines.push("}");
  return lines.join("\n");
}

function generateEnum(enumDef: PrismaEnum): string {
  const lines: string[] = [];

  if (enumDef.documentation) {
    const docLines = enumDef.documentation.split("\n");
    for (const line of docLines) {
      lines.push(`/// ${line}`);
    }
  }

  lines.push(`enum ${enumDef.name} {`);

  for (const value of enumDef.values) {
    lines.push(`  ${value}`);
  }

  lines.push("}");
  return lines.join("\n");
}

export function generatePrismaCode(
  schema: PrismaSchema,
  datasourceProvider: string = "postgresql"
): string {
  const lines: string[] = [];

  lines.push("generator client {");
  lines.push('  provider = "prisma-client-js"');
  lines.push("}");
  lines.push("");

  lines.push("datasource db {");
  lines.push(`  provider = "${datasourceProvider}"`);
  lines.push("}");
  lines.push("");

  if (schema.enums.length > 0) {
    for (const enumDef of schema.enums) {
      lines.push(generateEnum(enumDef));
      lines.push("");
    }
  }

  for (const model of schema.models) {
    lines.push(generateModel(model));
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
