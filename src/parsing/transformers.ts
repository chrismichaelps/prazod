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
  PrismaRelation,
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
import {
  PureFSTRelationMatcher,
  suggestBackRelationName,
} from "~/utils/relation-matcher";
import { createPrismaType } from "./factories/type-mapping-factory";

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
        : undefined;

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
      .filter((field) => !field.attributes.some((attr) => attr._tag === PRISMA_TAGS.Ignore))
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
      .filter((model) => !model.attributes.some((attr) => attr._tag === PRISMA_TAGS.Ignore))
      .map(modelToZodObject),
    enums: prisma.enums.map(enumToZodEnum),
  };
}

function zodTypeToPrismaType(zodType: ZodType): PrismaFieldType {
  return createPrismaType(zodType);
}

function zodFieldToPrismaField(
  field: ZodField,
  currentModelName: string,
  matcher: PureFSTRelationMatcher,
  allFields: readonly ZodField[]
): PrismaField {
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
    if (type._tag === ZOD_TAGS.ZodString) {
      if (type.validations?.some(v => v._tag === ZOD_VALIDATIONS.Cuid)) {
        attributes.push({ _tag: PRISMA_TAGS.Default, value: { _tag: PRISMA_TAGS.Cuid } });
      } else if (type.validations?.some(v => v._tag === ZOD_VALIDATIONS.Uuid)) {
        attributes.push({ _tag: PRISMA_TAGS.Default, value: { _tag: PRISMA_TAGS.Uuid } });
      }
    }
    if (type._tag === ZOD_TAGS.ZodNumber && type.validations?.some(v => v._tag === ZOD_VALIDATIONS.Int)) {
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

  // Parse @relation from documentation
  let hasRelation = false;
  let relationName: string | undefined;
  if (field.documentation) {
    const relationMatch = field.documentation.match(/@relation\(([^)]+)\)/);
    if (relationMatch && relationMatch[1]) {
      hasRelation = true;
      const content = relationMatch[1];

      // Parse relation name (could be first argument or named parameter)
      const nameMatch = content.match(/name:\s*"([^"]+)"/);
      if (nameMatch && nameMatch[1]) {
        relationName = nameMatch[1];
      } else if (content.match(/^"[^"]+"/)) {
        // Handle @relation("CategoryToCategory") or @relation("CategoryToCategory", fields: ...)
        const firstParamMatch = content.match(/^"([^"]+)"/);
        if (firstParamMatch && firstParamMatch[1]) {
          relationName = firstParamMatch[1];
        }
      }

      const fieldsMatch = content.match(/fields:\s*\[([^\]]+)\]/);
      const referencesMatch = content.match(/references:\s*\[([^\]]+)\]/);
      const onDeleteMatch = content.match(/onDelete:\s*(\w+)/);
      const onUpdateMatch = content.match(/onUpdate:\s*(\w+)/);

      if (fieldsMatch && fieldsMatch[1] && referencesMatch && referencesMatch[1]) {
        const relation: PrismaRelation = {
          fields: fieldsMatch[1].split(",").map(s => s.trim()),
          references: referencesMatch[1].split(",").map(s => s.trim()),
          name: relationName || "",
        };

        if (onDeleteMatch && onDeleteMatch[1]) {
          (relation as { onDelete?: PrismaRelation['onDelete'] }).onDelete = onDeleteMatch[1] as PrismaRelation['onDelete'];
        }

        if (onUpdateMatch && onUpdateMatch[1]) {
          (relation as { onUpdate?: PrismaRelation['onUpdate'] }).onUpdate = onUpdateMatch[1] as PrismaRelation['onUpdate'];
        }

        attributes.push({
          _tag: PRISMA_TAGS.Relation,
          relation,
        });
      } else if (relationName) {
        // For backward relations that only have a name
        attributes.push({
          _tag: PRISMA_TAGS.Relation,
          relation: {
            fields: [],
            references: [],
            name: relationName,
          },
        });
      }
    }

    // Parse @map
    const mapMatch = field.documentation.match(/@map\("([^"]+)"\)/);
    if (mapMatch && mapMatch[1]) {
      attributes.push({ _tag: PRISMA_TAGS.Map, name: mapMatch[1] });
    }

    // Parse native types (e.g. @db.Text, @db.VarChar(255))
    const nativeTypeMatch = field.documentation.match(/@db\.\w+(?:\([^)]+\))?/g);
    if (nativeTypeMatch) {
      nativeTypeMatch.forEach(match => {
        attributes.push({ _tag: PRISMA_TAGS.Native, value: match });
      });
    }
  }

  // Determine field type
  let fieldType: PrismaFieldType;
  if (hasRelation) {
    // Extract fields array from relation attributes if present
    const relationAttr = attributes.find(a => a._tag === PRISMA_TAGS.Relation);
    const relationFieldsArray = relationAttr && relationAttr._tag === PRISMA_TAGS.Relation
      ? relationAttr.relation.fields
      : undefined;

    fieldType = inferRelationModelType(
      field.name,
      currentModelName,
      matcher,
      relationName,
      allFields,
      relationFieldsArray,
      (type._tag === ZOD_TAGS.ZodObject) ? type.name : undefined
    );
  } else {
    const nativeTypeHint = field.documentation?.match(/@db\.(\w+)/)?.[1];
    fieldType = zodTypeToPrismaType(type);

    if (nativeTypeHint === 'Decimal') {
      fieldType = PRISMA_TYPES.Decimal;
    } else if (nativeTypeHint === 'Json') {
      fieldType = PRISMA_TYPES.Json;
      isList = false;
    }
  }

  return {
    name: field.name,
    type: fieldType,
    modifiers: {
      isList,
      isOptional,
      isUnique: field.documentation?.includes("@unique") ?? false,
    },
    attributes,
    ...(field.documentation && { documentation: field.documentation }),
  };
}
/**
 * Infer the model type for a relation field
 */
function inferRelationModelType(
  fieldName: string,
  currentModelName: string,
  matcher: PureFSTRelationMatcher,
  relationName?: string,
  allFields?: readonly ZodField[],
  relationFields?: readonly string[],
  zodTypeName?: string
): { _tag: "Model"; name: string } {
  // If we have an explicit Zod type name (e.g. from z.lazy(() => User)), use it!
  if (zodTypeName && zodTypeName !== "Nested" && zodTypeName !== "UnknownEnum") {
    return { _tag: PRISMA_TAGS.Model, name: zodTypeName };
  }
  // Check relation graph for ambiguous names (e.g. ShopOwner -> User)
  if (relationName) {
    const graphModel = matcher.getTargetModelFromGraph(relationName, currentModelName);
    if (graphModel) {
      return { _tag: PRISMA_TAGS.Model, name: graphModel };
    }
  }

  // Extract model from relation name (e.g. UserPosts -> User)
  if (relationName) {
    const extractedModel = extractModelFromRelationName(relationName, matcher, currentModelName);
    if (extractedModel) {
      return { _tag: PRISMA_TAGS.Model, name: extractedModel };
    }
  }

  // Infer from fields array (e.g. authorId -> Author)
  if (!relationName && relationFields && relationFields.length > 0) {
    const idFieldName = relationFields[0]; // Usually first field is the main FK

    if (idFieldName) {
      const modelFromIdField = extractModelFromIdFieldName(idFieldName, matcher, currentModelName);
      if (modelFromIdField) {
        return { _tag: PRISMA_TAGS.Model, name: modelFromIdField };
      }
    }
  }

  // Infer from foreign key correlation
  if (allFields) {
    const fkModel = inferFromForeignKeyPattern(fieldName, allFields, matcher, currentModelName);
    if (fkModel) {
      return { _tag: PRISMA_TAGS.Model, name: fkModel };
    }
  }

  // Use the custom relation matcher
  const result = matcher.match(fieldName, currentModelName);

  if (result) {
    return { _tag: PRISMA_TAGS.Model, name: result.modelName };
  }

  // Fallback to simple capitalization if no match found
  const fallback = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

  return {
    _tag: PRISMA_TAGS.Model,
    name: fallback,
  };
}

/**
 * Extract model name from ID field (e.g. authorId -> Author)
 */
function extractModelFromIdFieldName(
  idFieldName: string,
  matcher: PureFSTRelationMatcher,
  currentModelName?: string
): string | null {
  // Remove common ID suffixes
  const idSuffixes = ['Id', 'ID', '_id', '_ID'];
  let baseName = idFieldName;

  for (const suffix of idSuffixes) {
    if (idFieldName.endsWith(suffix)) {
      baseName = idFieldName.slice(0, -suffix.length);
      break;
    }
  }

  // If no suffix was removed, this might not be an ID field
  if (baseName === idFieldName) {
    return null;
  }

  // Capitalize the base name (authorId -> Author, userId -> User)
  const capitalizedBase = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  // Fuzzy match base name against models
  const result = matcher.match(baseName, currentModelName || '');
  if (result) {
    // Only use the fuzzy match if it has decent confidence AND the model actually exists
    // Avoid false positives by checking if the matched model is in our list
    if (result.confidence > 0.5 && matcher.modelNames.includes(result.modelName)) {
      return result.modelName;
    }
  }

  // Try exact match first (e.g., "author" -> "Author" if "Author" model exists)
  if (matcher.modelNames.includes(capitalizedBase)) {
    return capitalizedBase;
  }

  return null;
}

/**
 * Infer model from foreign key pattern (e.g. authorId -> Author)
 */
function inferFromForeignKeyPattern(
  fieldName: string,
  allFields: readonly ZodField[],
  matcher: PureFSTRelationMatcher,
  currentModelName: string
): string | null {
  // Strategy 1: Direct FK correlation
  const possibleIdField = `${fieldName}Id`;
  let idField = allFields.find(f => f.name === possibleIdField);

  if (idField && idField.documentation) {
    const model = extractModelFromIdField(idField, matcher, currentModelName);
    if (model) return model;
  }

  // Strategy 2: Reverse correlation
  if (fieldName.endsWith('Id')) {
    const baseFieldName = fieldName.slice(0, -2); // Remove 'Id'
    const relationField = allFields.find(f => f.name === baseFieldName);

    if (relationField) {
      // The relation field exists, check our own documentation
      if (idField && idField.documentation) {
        const model = extractModelFromIdField({ name: fieldName, documentation: idField.documentation } as ZodField, matcher, currentModelName);
        if (model) return model;
      }
    }
  }

  // Strategy 3: Pattern detection across all ID fields
  const idVariants = [
    `${fieldName}Id`,
    `${fieldName}ID`,
    `${fieldName}_id`,
    `${fieldName}_ID`,
  ];

  for (const variant of idVariants) {
    const foundField = allFields.find(f => f.name === variant || f.name.toLowerCase() === variant.toLowerCase());
    if (foundField && foundField.documentation) {
      const model = extractModelFromIdField(foundField, matcher, currentModelName);
      if (model) return model;
    }
  }

  return null;
}

/**
 * Extract model name from an ID field's @relation annotation
 */
function extractModelFromIdField(
  idField: ZodField,
  matcher: PureFSTRelationMatcher,
  currentModelName?: string
): string | null {
  if (!idField.documentation) return null;

  // Check if this ID field has a @relation annotation
  const relationMatch = idField.documentation.match(/@relation\(([^)]+)\)/);
  if (!relationMatch || !relationMatch[1]) return null;

  const content = relationMatch[1];

  // Try to extract relation name
  const nameMatch = content.match(/name:\s*"([^"]+)"/);
  const firstParamMatch = content.match(/^"([^"]+)"/);
  const relationName = (nameMatch && nameMatch[1]) || (firstParamMatch && firstParamMatch[1]);

  if (relationName) {
    return extractModelFromRelationName(relationName, matcher, currentModelName);
  }

  return null;
}

/**
 * Extract model name from relation name
 */
function extractModelFromRelationName(
  relationName: string,
  matcher: PureFSTRelationMatcher,
  currentModelName?: string
): string | null {
  const modelNames = Array.from(matcher.modelNames);
  const words = relationName.split(/(?=[A-Z])/);

  // Helper to check if a word maps to a model
  const findModel = (word: string): string | null => {
    if (modelNames.includes(word)) return word;

    // Check for pluralization (Category -> Categories)
    // Simple singularization heuristics
    if (word.endsWith('s')) {
      const singular = word.slice(0, -1);
      if (modelNames.includes(singular)) return singular;
    }
    if (word.endsWith('ies')) {
      const singular = word.slice(0, -3) + 'y';
      if (modelNames.includes(singular)) return singular;
    }

    // Avoid infinite recursion
    return null;
  };

  // Try first word first (most common pattern: "UserPosts", "CommentReplies")
  if (words.length > 0 && words[0]) {
    const firstWord = words[0];
    const firstModel = findModel(firstWord);

    if (firstModel) {
      // If first word matches current model, try finding another model in the name
      if (currentModelName && firstModel === currentModelName && words.length > 1) {
        // Try the second word
        const secondWord = words[1];
        if (secondWord) {
          const secondModel = findModel(secondWord);
          if (secondModel) return secondModel;
        }

        // Try the rest of the string combined
        const rest = words.slice(1).join('');
        const restModel = findModel(rest);
        if (restModel) return restModel;
      }
      return firstModel;
    }
  }

  // Try finding model name as prefix (longest match first)
  const sortedModels = [...modelNames].sort((a, b) => b.length - a.length);

  for (const modelName of sortedModels) {
    if (relationName.startsWith(modelName)) {
      // Same check: if prefix matches current model, look for other models in the suffix
      if (currentModelName && modelName === currentModelName) {
        const suffix = relationName.slice(modelName.length);
        if (suffix) {
          const suffixModel = findModel(suffix);
          if (suffixModel) return suffixModel;

          // Try to find model in suffix using prefix match again
          for (const otherModel of sortedModels) {
            if (suffix.startsWith(otherModel)) return otherModel;
          }
        }
      }
      return modelName;
    }
  }

  // Try each word in order (avoiding partial matches)
  for (const word of words) {
    if (word) {
      const model = findModel(word);
      if (model) return model;
    }
  }

  for (const modelName of sortedModels) {
    if (relationName.includes(modelName)) {
      return modelName;
    }
  }

  return null;
}

function zodObjectToPrismaModel(obj: ZodObject, matcher: PureFSTRelationMatcher): PrismaModel {
  const attributes: import("~/domain/prisma-ast").PrismaModelAttribute[] = [];

  if (obj.documentation) {
    // Parse @@index
    const indexMatches = obj.documentation.matchAll(/@@index\(\[([^\]]+)\](?:,\s*name:\s*"([^"]+)")?\)/g);
    for (const match of indexMatches) {
      if (match[1]) {
        attributes.push({
          _tag: PRISMA_TAGS.Index,
          fields: match[1].split(",").map(s => s.trim()),
          ...(match[2] ? { name: match[2] } : {}),
        });
      }
    }

    // Parse @@unique (composite)
    const uniqueMatches = obj.documentation.matchAll(/@@unique\(\[([^\]]+)\](?:,\s*name:\s*"([^"]+)")?\)/g);
    for (const match of uniqueMatches) {
      if (match[1]) {
        attributes.push({
          _tag: PRISMA_TAGS.Unique,
          fields: match[1].split(",").map(s => s.trim()),
          ...(match[2] ? { name: match[2] } : {}),
        });
      }
    }

    // Parse @@fulltext
    const fullTextMatches = obj.documentation.matchAll(/@@fulltext\(\[([^\]]+)\](?:,\s*map:\s*"([^"]+)")?\)/g);
    for (const match of fullTextMatches) {
      if (match[1]) {
        attributes.push({
          _tag: PRISMA_TAGS.FullText,
          fields: match[1].split(",").map(s => s.trim()),
          ...(match[2] ? { map: match[2] } : {}),
        });
      }
    }

    // Parse @@id (composite)
    const idMatch = obj.documentation.match(/@@id\(\[([^\]]+)\]\)/);
    if (idMatch && idMatch[1]) {
      attributes.push({
        _tag: PRISMA_TAGS.Id,
        fields: idMatch[1].split(",").map(s => s.trim()),
      });
    }

    // Parse @@map
    const mapMatch = obj.documentation.match(/@@map\("([^"]+)"\)/);
    if (mapMatch && mapMatch[1]) {
      attributes.push({ _tag: PRISMA_TAGS.Map, name: mapMatch[1] });
    }
  }

  return {
    name: obj.name,
    fields: obj.fields.map(field => zodFieldToPrismaField(field, obj.name, matcher, obj.fields)),
    attributes,
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
  const allModelNames = zod.objects.map(obj => obj.name);

  // Create a single relation matcher instance
  const matcher = new PureFSTRelationMatcher(allModelNames);

  // Learn global patterns from the entire schema first
  matcher.learnGlobalPatterns(zod.objects);

  // Create initial models
  let models: PrismaModel[] = zod.objects.map(obj => zodObjectToPrismaModel(obj, matcher));
  const enums = zod.enums.map(zodEnumToPrismaEnum);

  // Post-process: fix self-relations and 1:1 relations
  const modelMap = new Map(models.map(m => [m.name, m]));

  // detect self-referential relation
  const isSelfReferentialRelation = (
    fieldType: PrismaFieldType,
    currentModelName: string
  ): boolean => {
    return typeof fieldType === "object" &&
      fieldType._tag === PRISMA_TAGS.Model &&
      fieldType.name === currentModelName;
  };

  // find the foreign key field that matches a relation field
  const findFkFieldForRelation = (
    relationFieldName: string,
    model: PrismaModel
  ): PrismaField | null => {
    const candidates = [
      `${relationFieldName}Id`,
      `${relationFieldName}ID`,
      `${relationFieldName}_id`,
      `${relationFieldName}_ID`,
    ];
    return model.fields.find(f => candidates.includes(f.name)) || null;
  };

  // First pass: enrich forward relations with fields/references when possible
  models = models.map(model => {
    const fieldsToMakeUnique = new Set<string>();

    const updatedFields = model.fields.map(field => {
      // Check if it's a relation field (type is Model)
      const isRelationField = typeof field.type === 'object' && '_tag' in field.type && field.type._tag === PRISMA_TAGS.Model;

      if (!isRelationField) return field;

      let relationAttr = field.attributes.find(a => a._tag === PRISMA_TAGS.Relation) as
        | Extract<PrismaFieldAttribute, { _tag: "Relation" }>
        | undefined;

      // If missing, create a default one
      let isNewAttr = false;
      if (!relationAttr) {
        relationAttr = {
          _tag: PRISMA_TAGS.Relation,
          relation: {
            name: "",
            fields: [],
            references: []
          }
        };
        isNewAttr = true;
      }

      let rel = { ...relationAttr.relation };
      const isSelfRef = isSelfReferentialRelation(field.type, model.name);
      let changed = isNewAttr;

      // Ensure self-relations have a name
      if (isSelfRef && !rel.name) {
        rel.name = `${model.name}To${model.name}`;
        changed = true;
      }

      // If already has fields/references => check if we just added name/created attr, otherwise nothing to do
      if (rel.fields.length > 0 || rel.references.length > 0) {
        if (changed) {
          const newAttr = { ...relationAttr, relation: rel };
          let newAttributes;

          if (isNewAttr) {
            newAttributes = [...field.attributes, newAttr];
          } else {
            newAttributes = field.attributes.map(a =>
              a._tag === PRISMA_TAGS.Relation ? newAttr : a
            );
          }
          return { ...field, attributes: newAttributes };
        }
        return field;
      }

      // Try to infer FK field (e.g. parent => parentId)
      const fkField = findFkFieldForRelation(field.name, model);

      // For self-relations: always add fields/references on the forward side
      // For 1:1: add only if this side has the FK column
      const shouldAddFk = fkField && (isSelfRef || !field.modifiers.isList);

      if (shouldAddFk) {
        rel.fields = [fkField.name];
        rel.references = ["id"]; // assume target has @id field named "id"
        changed = true;

        // Check if it is a 1:1 relation to enforce uniqueness on FK
        if (!field.modifiers.isList) {
          const targetModelName = (field.type as any).name;
          const targetModel = modelMap.get(targetModelName);

          if (targetModel) {
            const backField = targetModel.fields.find(f =>
              typeof f.type === 'object' &&
              f.type._tag === PRISMA_TAGS.Model &&
              f.type.name === model.name
            );

            if (backField && !backField.modifiers.isList) {
              fieldsToMakeUnique.add(fkField.name);
            }
          }
        }
      }

      if (changed) {
        const newAttr = { ...relationAttr, relation: rel };
        let newAttributes;

        if (isNewAttr) {
          newAttributes = [...field.attributes, newAttr];
        } else {
          newAttributes = field.attributes.map(a =>
            a._tag === PRISMA_TAGS.Relation ? newAttr : a
          );
        }

        return { ...field, attributes: newAttributes };
      }

      return field;
    });

    // Apply unique constraints to FK fields for 1:1 relations
    const finalFields = updatedFields.map(f => {
      if (fieldsToMakeUnique.has(f.name)) {
        // Check if it already has @unique
        const hasUnique = f.attributes.some(a => a._tag === PRISMA_TAGS.Unique);
        if (hasUnique) return f;

        return {
          ...f,
          attributes: [
            ...f.attributes,
            { _tag: PRISMA_TAGS.Unique, unique: {} }
          ]
        };
      }
      return f;
    });

    return { ...model, fields: finalFields };
  });

  // Second pass: add missing back-relations (with smart naming)
  const newFieldsByModel = new Map<string, PrismaField[]>();

  for (const model of models) {
    for (const field of model.fields) {
      const relationAttr = field.attributes.find(a => a._tag === PRISMA_TAGS.Relation) as Extract<PrismaFieldAttribute, { _tag: "Relation" }> | undefined;
      if (!relationAttr || relationAttr._tag !== PRISMA_TAGS.Relation) continue;

      const targetModelName = (field.type as any).name;
      if (typeof targetModelName !== "string") continue;

      const targetModel = modelMap.get(targetModelName);
      if (!targetModel) continue;

      // Skip if back-relation already exists
      const hasBackRelation = targetModel.fields.some(f => {
        if (typeof f.type !== "object" || f.type._tag !== PRISMA_TAGS.Model) return false;
        return f.type.name === model.name;
      }) || (newFieldsByModel.get(targetModelName) || []).some(f =>
        (f.type as any).name === model.name
      );

      if (hasBackRelation) continue;

      // Generate smart back-relation name
      let backFieldName = suggestBackRelationName(field.name, model.name, models.map(m => m.name)) ||
        `${model.name.charAt(0).toLowerCase() + model.name.slice(1)}s`;

      // Special cases for self-relations
      if (model.name === targetModelName) {
        if (field.name === "parent" || field.name === "parentId") backFieldName = "children";
        else if (field.name === "manager") backFieldName = "employees";
        else if (field.name === "supervisor") backFieldName = "subordinates";
      }

      const backAttrs: PrismaFieldAttribute[] = [];

      // Copy relation name if exists
      if (relationAttr.relation.name) {
        backAttrs.push({
          _tag: PRISMA_TAGS.Relation,
          relation: {
            fields: [],
            references: [],
            name: relationAttr.relation.name,
          },
        });
      }

      const backField: PrismaField = {
        name: backFieldName,
        type: { _tag: PRISMA_TAGS.Model, name: model.name },
        modifiers: {
          isList: true,
          isOptional: false,
          isUnique: false,
        },
        attributes: backAttrs,
        documentation: "Autogenerated back-relation",
      };

      newFieldsByModel.set(targetModelName, [
        ...(newFieldsByModel.get(targetModelName) || []),
        backField,
      ]);
    }
  }

  // Apply back-relations
  if (newFieldsByModel.size > 0) {
    models = models.map(model => {
      const extras = newFieldsByModel.get(model.name);
      if (!extras) return model;

      const extraNames = new Set(extras.map(f => f.name));
      const filtered = model.fields.filter(f => !extraNames.has(f.name));

      return { ...model, fields: [...filtered, ...extras] };
    });
  }

  return {
    models,
    enums,
  };
}