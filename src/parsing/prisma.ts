/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Layer } from "effect";
import PrismaInternals from "@prisma/internals";
import type { DMMF } from "@prisma/generator-helper";

const { getDMMF } = PrismaInternals;
import { PrismaParser } from "~/context";
import type {
  PrismaSchema,
  PrismaModel,
  PrismaField,
  PrismaFieldType,
  PrismaFieldAttribute,
  PrismaEnum,
} from "~/domain/prisma-ast";
import { SyntaxError, InvalidModelError } from "~/domain/errors";
import type { ParseError } from "~/domain/errors";
import {
  PRISMA_TAGS,
  PRISMA_TYPES,
  DMMF_KINDS,
  PRISMA_ACTIONS,
} from "./constants";
import { createDefaultValue } from "./factories/default-value-factory";

function mapFieldType(kind: string, type: string): PrismaFieldType {
  if (kind === DMMF_KINDS.Scalar) {
    return type; // Dynamic pass-through
  }

  if (kind === DMMF_KINDS.Enum) {
    return { _tag: PRISMA_TAGS.Enum, name: type };
  }

  if (kind === DMMF_KINDS.Object) {
    return { _tag: PRISMA_TAGS.Model, name: type };
  }

  return PRISMA_TYPES.String; // Fallback
}

// Parse default value from DMMF
function parseDefaultValue(
  defaultValue: unknown
): import("~/domain/prisma-ast").PrismaDefaultValue {
  return createDefaultValue(defaultValue);
}

// Parse DMMF field
function parseDMMFField(field: DMMF.Field): PrismaField {
  const attributes: PrismaFieldAttribute[] = [];

  if (field.isId) {
    attributes.push({ _tag: PRISMA_TAGS.Id });
  }
  if (field.isUnique) {
    attributes.push({ _tag: PRISMA_TAGS.Unique });
  }
  if (field.isUpdatedAt) {
    attributes.push({ _tag: PRISMA_TAGS.UpdatedAt });
  }

  if ('isIgnored' in field && typeof (field as { isIgnored?: boolean }).isIgnored === 'boolean' && (field as { isIgnored: boolean }).isIgnored) {
    attributes.push({ _tag: PRISMA_TAGS.Ignore });
  }
  if (field.hasDefaultValue && field.default !== undefined) {
    attributes.push({
      _tag: PRISMA_TAGS.Default,
      value: parseDefaultValue(field.default),
    });
  }
  if (field.kind === DMMF_KINDS.Object && field.relationName) {
    attributes.push({
      _tag: PRISMA_TAGS.Relation,
      relation: {
        name: field.relationName,
        fields: field.relationFromFields || [],
        references: field.relationToFields || [],
        ...(field.relationOnDelete !== undefined && {
          onDelete: field.relationOnDelete as
            | typeof PRISMA_ACTIONS.Cascade
            | typeof PRISMA_ACTIONS.Restrict
            | typeof PRISMA_ACTIONS.NoAction
            | typeof PRISMA_ACTIONS.SetNull,
        }),
      },
    });
  }

  return {
    name: field.name,
    type: mapFieldType(field.kind, field.type),
    modifiers: {
      isOptional: !field.isRequired,
      isList: field.isList,
      isUnique: field.isUnique,
    },
    attributes,
    ...(field.documentation !== undefined && {
      documentation: field.documentation,
    }),
  };
}

function parseDMMFModel(model: DMMF.Model): PrismaModel {
  const attributes: import("~/domain/prisma-ast").PrismaModelAttribute[] = [];

  // Parse @@id (compound primary key)
  if (model.primaryKey) {
    attributes.push({
      _tag: PRISMA_TAGS.Id,
      fields: model.primaryKey.fields,
    });
  }

  // Parse @@unique (compound unique constraints)
  if (model.uniqueFields && model.uniqueFields.length > 0) {
    for (const uniqueConstraint of model.uniqueFields) {
      attributes.push({
        _tag: PRISMA_TAGS.Unique,
        fields: uniqueConstraint,
      });
    }
  }

  // Parse @@index
  if (model.uniqueIndexes && model.uniqueIndexes.length > 0) {
    for (const index of model.uniqueIndexes) {
      attributes.push({
        _tag: PRISMA_TAGS.Index,
        fields: index.fields,
      });
    }
  }

  // Parse @@map (table name mapping)
  if (model.dbName && model.dbName !== model.name) {
    attributes.push({
      _tag: PRISMA_TAGS.Map,
      name: model.dbName,
    });
  }

  if ('isIgnored' in model && typeof (model as { isIgnored?: boolean }).isIgnored === 'boolean' && (model as { isIgnored: boolean }).isIgnored) {
    attributes.push({ _tag: PRISMA_TAGS.Ignore });
  }

  return {
    name: model.name,
    fields: model.fields.map((f) => parseDMMFField(f)),
    attributes,
    ...(model.documentation !== undefined && {
      documentation: model.documentation,
    }),
  };
}

// Parse DMMF enum
function parseDMMFEnum(enumDef: DMMF.DatamodelEnum): PrismaEnum {
  return {
    name: enumDef.name,
    values: enumDef.values.map((v) => v.name),
    ...(enumDef.documentation !== undefined && {
      documentation: enumDef.documentation,
    }),
  };
}

// Parse DMMF to our domain model
function parseDMMF(dmmf: DMMF.Document): PrismaSchema {
  return {
    models: dmmf.datamodel.models.map((m) => parseDMMFModel(m)),
    enums: dmmf.datamodel.enums.map((e) => parseDMMFEnum(e)),
  };
}



// Prisma parser using @prisma/internals
export const PrismaParserLive = Layer.succeed(
  PrismaParser,
  PrismaParser.of({
    parse: (schema: string) =>
      Effect.tryPromise({
        try: async () => {
          const dmmf = await getDMMF({ datamodel: schema });
          return parseDMMF(dmmf);
        },
        catch: (error): ParseError => {
          if (error && typeof error === "object" && "message" in error) {
            const msg = String(error.message);
            const lineMatch = msg.match(/line (\d+)/);
            const lineStr = lineMatch?.[1];
            const line = lineStr !== undefined ? parseInt(lineStr, 10) : 0;
            return new SyntaxError({
              line,
              column: 0,
              message: msg,
              ...(error instanceof Error && { cause: error }),
            }) as unknown as ParseError;
          }
          return new SyntaxError({
            line: 0,
            column: 0,
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof Error && { cause: error }),
          }) as unknown as ParseError;
        },
      }),

    validate: (schema: PrismaSchema): Effect.Effect<void, ParseError, never> =>
      Effect.gen(function* (_) {
        const errors: ParseError[] = [];

        // Validate each model
        for (const model of schema.models) {
          // Check for empty models
          if (model.fields.length === 0) {
            errors.push(
              new InvalidModelError({
                modelName: model.name,
                reason: "Model has no fields",
              })
            );
          }

          // Check for duplicate fields
          const fieldNames = new Set<string>();
          for (const field of model.fields) {
            if (fieldNames.has(field.name)) {
              errors.push(
                new InvalidModelError({
                  modelName: model.name,
                  reason: `Duplicate field "${field.name}"`,
                })
              );
            }
            fieldNames.add(field.name);
          }
        }

        // Validate enums
        for (const enumDef of schema.enums) {
          if (enumDef.values.length === 0) {
            errors.push(
              new InvalidModelError({
                modelName: enumDef.name,
                reason: "Enum has no values",
              })
            );
          }
        }

        if (errors.length > 0) {
          return yield* _(Effect.fail(errors[0]!));
        }

        return undefined;
      }),
  })
);
