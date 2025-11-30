/**
 * Author: Chris M. Pérez
 * License: MIT
 */

export { ZOD_TAGS, ZOD_VALIDATIONS, PRISMA_TAGS, PRISMA_TYPES } from "~/domain/constants";

export const ZOD_CHECKS = {
  min: "min",
  max: "max",
  email: "email",
  url: "url",
  uuid: "uuid",
  cuid: "cuid",
  cuid2: "cuid2",
  ulid: "ulid",
  nanoid: "nanoid",
  emoji: "emoji",
  regex: "regex",
  includes: "includes",
  startsWith: "startsWith",
  endsWith: "endsWith",
  int: "int",
  multipleOf: "multipleOf",
  finite: "finite",
} as const;



export const DMMF_KINDS = {
  Scalar: "scalar",
  Enum: "enum",
  Object: "object",
} as const;

export const PRISMA_FUNCTIONS = {
  AutoIncrement: "autoincrement",
  Now: "now",
  Uuid: "uuid",
  Cuid: "cuid",
  DbGenerated: "dbgenerated",
  Auto: "auto",
  Sequence: "sequence",
  Ulid: "ulid",
  Nanoid: "nanoid",
} as const;

export const PRISMA_ACTIONS = {
  Cascade: "Cascade",
  Restrict: "Restrict",
  NoAction: "NoAction",
  SetNull: "SetNull",
} as const;
