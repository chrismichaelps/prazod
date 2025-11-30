/**
 * Author: Chris M. Pérez
 * License: MIT
 */

export type ZodType =
  | { readonly _tag: "ZodString"; readonly validations: ReadonlyArray<StringValidation> }
  | { readonly _tag: "ZodNumber"; readonly validations: ReadonlyArray<NumberValidation> }
  | { readonly _tag: "ZodBigInt" }
  | { readonly _tag: "ZodBoolean" }
  | { readonly _tag: "ZodDate" }
  | { readonly _tag: "ZodNull" }
  | { readonly _tag: "ZodUndefined" }
  | { readonly _tag: "ZodNaN" }
  | { readonly _tag: "ZodUnknown" }
  | { readonly _tag: "ZodLiteral"; readonly value: string | number | boolean }
  | { readonly _tag: "ZodArray"; readonly element: ZodType }
  | { readonly _tag: "ZodTuple"; readonly items: ReadonlyArray<ZodType> }
  | { readonly _tag: "ZodUnion"; readonly options: ReadonlyArray<ZodType> }
  | { readonly _tag: "ZodRecord"; readonly keyType: ZodType; readonly valueType: ZodType }
  | { readonly _tag: "ZodObject"; readonly name: string }
  | { readonly _tag: "ZodEnum"; readonly name: string }
  | { readonly _tag: "ZodOptional"; readonly inner: ZodType }
  | { readonly _tag: "ZodNullable"; readonly inner: ZodType }
  | {
    readonly _tag: "ZodDefault";
    readonly inner: ZodType;
    readonly defaultValue: unknown;
  };


export type StringValidation =
  | { readonly _tag: "MinLength"; readonly value: number }
  | { readonly _tag: "MaxLength"; readonly value: number }
  | { readonly _tag: "Length"; readonly value: number }
  | { readonly _tag: "Email" }
  | { readonly _tag: "Url" }
  | { readonly _tag: "Uuid" }
  | { readonly _tag: "Cuid" }
  | { readonly _tag: "Cuid2" }
  | { readonly _tag: "Ulid" }
  | { readonly _tag: "Nanoid" }
  | { readonly _tag: "Datetime"; readonly options?: { offset?: boolean; precision?: number } }
  | { readonly _tag: "Ip"; readonly version?: "v4" | "v6" }
  | { readonly _tag: "Regex"; readonly pattern: string }
  | { readonly _tag: "Emoji" }
  | { readonly _tag: "Base64" }
  | { readonly _tag: "Trim" }
  | { readonly _tag: "ToLowerCase" }
  | { readonly _tag: "ToUpperCase" }
  | { readonly _tag: "StartsWith"; readonly value: string }
  | { readonly _tag: "EndsWith"; readonly value: string }
  | { readonly _tag: "Includes"; readonly value: string };


export type NumberValidation =
  | { readonly _tag: "Min"; readonly value: number }
  | { readonly _tag: "Max"; readonly value: number }
  | { readonly _tag: "Gt"; readonly value: number }
  | { readonly _tag: "Gte"; readonly value: number }
  | { readonly _tag: "Lt"; readonly value: number }
  | { readonly _tag: "Lte"; readonly value: number }
  | { readonly _tag: "Int" }
  | { readonly _tag: "Positive" }
  | { readonly _tag: "Nonnegative" }
  | { readonly _tag: "Negative" }
  | { readonly _tag: "Nonpositive" }
  | { readonly _tag: "MultipleOf"; readonly value: number }
  | { readonly _tag: "Step"; readonly value: number }
  | { readonly _tag: "Finite" }
  | { readonly _tag: "Safe" };


export interface ZodField {
  readonly name: string;
  readonly type: ZodType;
  readonly documentation?: string;
}


export interface ZodObject {
  readonly name: string;
  readonly fields: ReadonlyArray<ZodField>;
  readonly documentation?: string;
}


export interface ZodEnum {
  readonly name: string;
  readonly values: ReadonlyArray<string>;
  readonly documentation?: string;
}


export interface ZodSchema {
  readonly objects: ReadonlyArray<ZodObject>;
  readonly enums: ReadonlyArray<ZodEnum>;
}


import { ZOD_TAGS } from "./constants";

export const ZodType = {
  string: (validations: ReadonlyArray<StringValidation> = []): ZodType => ({
    _tag: ZOD_TAGS.ZodString,
    validations,
  }),
  number: (validations: ReadonlyArray<NumberValidation> = []): ZodType => ({
    _tag: ZOD_TAGS.ZodNumber,
    validations,
  }),
  bigint: (): ZodType => ({ _tag: ZOD_TAGS.ZodBigInt }),
  boolean: (): ZodType => ({ _tag: ZOD_TAGS.ZodBoolean }),
  date: (): ZodType => ({ _tag: ZOD_TAGS.ZodDate }),
  unknown: (): ZodType => ({ _tag: ZOD_TAGS.ZodUnknown }),
  array: (element: ZodType): ZodType => ({ _tag: ZOD_TAGS.ZodArray, element }),
  object: (name: string): ZodType => ({ _tag: ZOD_TAGS.ZodObject, name }),
  enum: (name: string): ZodType => ({ _tag: ZOD_TAGS.ZodEnum, name }),
  optional: (inner: ZodType): ZodType => ({ _tag: ZOD_TAGS.ZodOptional, inner }),
  nullable: (inner: ZodType): ZodType => ({ _tag: ZOD_TAGS.ZodNullable, inner }),
};
