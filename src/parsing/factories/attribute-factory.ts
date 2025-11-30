/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { PRISMA_TAGS } from "~/domain/constants";
import type { PrismaFieldAttribute, PrismaFieldType } from "~/domain/prisma-ast";

type AttributeFormatter = (attr: any, fieldType: PrismaFieldType) => string;

const formatDefaultValue = (def: any, isEnum: boolean): string => {
  const handlers: Record<string, () => string> = {
    AutoIncrement: () => "autoincrement()",
    Auto: () => "auto()",
    Now: () => "now()",
    Uuid: () => "uuid()",
    Cuid: () => "cuid()",
    Ulid: () => "ulid()",
    Nanoid: () => def.length ? `nanoid(${def.length})` : "nanoid()",
    DbGenerated: () => `dbgenerated("${def.expression}")`,
    Literal: () => {
      if (isEnum) return String(def.value);
      return typeof def.value === "string" ? `"${def.value}"` : String(def.value);
    },
    Sequence: () => {
      if (!def.options) return "sequence()";
      const parts: string[] = [];
      if (def.options.start !== undefined) parts.push(`start: ${def.options.start}`);
      if (def.options.increment !== undefined) parts.push(`increment: ${def.options.increment}`);
      return parts.length > 0 ? `sequence(${parts.join(", ")})` : "sequence()";
    },
  };

  return handlers[def._tag]?.() || "";
};

const formatters: Record<string, AttributeFormatter> = {
  [PRISMA_TAGS.Id]: () => "@id",
  [PRISMA_TAGS.Unique]: () => "@unique",
  [PRISMA_TAGS.UpdatedAt]: () => "@updatedAt",
  [PRISMA_TAGS.Ignore]: () => "@ignore",
  [PRISMA_TAGS.Map]: (attr) => `@map("${attr.name}")`,

  [PRISMA_TAGS.Default]: (attr, fieldType) => {
    const isEnum = typeof fieldType !== "string" && fieldType._tag === "Enum";
    return `@default(${formatDefaultValue(attr.value, isEnum)})`;
  },

  [PRISMA_TAGS.Relation]: (attr) => {
    const parts: string[] = [];
    const rel = attr.relation;

    if (rel.name) parts.push(`name: "${rel.name}"`);
    if (rel.fields?.length) parts.push(`fields: [${rel.fields.join(", ")}]`);
    if (rel.references?.length) parts.push(`references: [${rel.references.join(", ")}]`);
    if (rel.onDelete) parts.push(`onDelete: ${rel.onDelete}`);

    return `@relation(${parts.join(", ")})`;
  },
};

export function createAttribute(
  attr: PrismaFieldAttribute,
  fieldType: PrismaFieldType
): string {
  const formatter = formatters[attr._tag];
  if (!formatter) {
    throw new Error(`Unknown attribute: ${attr._tag}`);
  }
  return formatter(attr, fieldType);
}
