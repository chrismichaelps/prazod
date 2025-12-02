/**
 * Author: Chris M. Pérez
 * License: MIT
 */

export type PrismaFieldType =
  | string // Allow any string for scalars (dynamic)
  | { readonly _tag: "Enum"; readonly name: string }
  | { readonly _tag: "Model"; readonly name: string };

export interface PrismaFieldModifiers {
  readonly isOptional: boolean;
  readonly isList: boolean;
  readonly isUnique: boolean;
}

export type PrismaDefaultValue =
  | { readonly _tag: "Literal"; readonly value: string | number | boolean }
  | { readonly _tag: "AutoIncrement" }
  | { readonly _tag: "Auto" }
  | { readonly _tag: "Sequence"; readonly options?: { readonly minValue?: number; readonly maxValue?: number; readonly start?: number; readonly increment?: number; readonly cache?: number } }
  | { readonly _tag: "Now" }
  | { readonly _tag: "Uuid" }
  | { readonly _tag: "Cuid" }
  | { readonly _tag: "Ulid" }
  | { readonly _tag: "Nanoid"; readonly length?: number }
  | { readonly _tag: "DbGenerated"; readonly expression?: string };

export type PrismaFieldAttribute =
  | { readonly _tag: "Default"; readonly value: PrismaDefaultValue }
  | { readonly _tag: "Unique" }
  | { readonly _tag: "Id" }
  | { readonly _tag: "UpdatedAt" }
  | { readonly _tag: "Ignore" }
  | { readonly _tag: "Map"; readonly name: string }
  | { readonly _tag: "Relation"; readonly relation: PrismaRelation }
  | { readonly _tag: "Native"; readonly value: string };

export interface PrismaField {
  readonly name: string;
  readonly type: PrismaFieldType;
  readonly modifiers: PrismaFieldModifiers;
  readonly attributes: ReadonlyArray<PrismaFieldAttribute>;
  readonly documentation?: string;
}

export interface PrismaRelation {
  readonly name?: string;
  readonly fields: ReadonlyArray<string>;
  readonly references: ReadonlyArray<string>;
  readonly onDelete?: "Cascade" | "Restrict" | "NoAction" | "SetNull" | "SetDefault";
  readonly onUpdate?: "Cascade" | "Restrict" | "NoAction" | "SetNull" | "SetDefault";
  readonly map?: string;
}

export type PrismaModelAttribute =
  | { readonly _tag: "Id"; readonly fields: ReadonlyArray<string> }
  | { readonly _tag: "Unique"; readonly fields: ReadonlyArray<string>; readonly name?: string }
  | { readonly _tag: "Index"; readonly fields: ReadonlyArray<string>; readonly name?: string }
  | { readonly _tag: "FullText"; readonly fields: ReadonlyArray<string>; readonly name?: string; readonly map?: string }
  | { readonly _tag: "Ignore" }
  | { readonly _tag: "Schema"; readonly name: string }
  | { readonly _tag: "Map"; readonly name: string };


export interface PrismaModel {
  readonly name: string;
  readonly fields: ReadonlyArray<PrismaField>;
  readonly attributes: ReadonlyArray<PrismaModelAttribute>;
  readonly documentation?: string;
}

export interface PrismaEnum {
  readonly name: string;
  readonly values: ReadonlyArray<string>;
  readonly documentation?: string;
}

export interface PrismaSchema {
  readonly models: ReadonlyArray<PrismaModel>;
  readonly enums: ReadonlyArray<PrismaEnum>;
}
