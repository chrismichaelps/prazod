/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import type { ZodSchema, ZodObject, ZodEnum } from "~/domain/zod-ast";
import type { ModuleGroup } from "./module-grouping";
import { generateType } from "./zod";
import { toKebabCase } from "~/utils/string-utils";

/**
 * Represents a file to be generated
 */
export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

/**
 * Options for modular generation
 */
export interface ModularGenerationOptions {
  readonly baseDir: string;
  readonly groups: ReadonlyArray<ModuleGroup>;
}

/**
 * Generates index file for a module
 */
function generateModuleIndex(group: ModuleGroup): string {
  const exports: string[] = [];

  // Export all models
  for (const model of group.models) {
    const fileName = toKebabCase(model);
    exports.push(`export * from "./${fileName}.schema";`);
  }

  return exports.join("\n") + "\n";
}

/**
 * Generates index file for the enums folder
 */
function generateEnumsIndex(enumNames: ReadonlyArray<string>): string {
  const exports: string[] = [];

  for (const enumName of enumNames) {
    const fileName = toKebabCase(enumName);
    exports.push(`export * from "./${fileName}";`);
  }

  return exports.join("\n") + "\n";
}

/**
 * Generates root index file that re-exports all modules
 */
function generateRootIndex(groups: ReadonlyArray<ModuleGroup>): string {
  const lines: string[] = [];

  // Export from enums if exists
  if (groups.some(g => g.name === "enums")) {
    lines.push(`export * from "./enums";`);
  }

  // Export from each domain module
  for (const group of groups) {
    if (group.name !== "enums") {
      lines.push(`export * from "./${group.name}";`);
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Generates individual schema file content
 */
function generateSchemaFile(
  zodObject: ZodObject,
  imports: Set<string>
): string {
  const lines: string[] = [];

  // Add imports
  lines.push(`import { z } from "zod";`);

  if (imports.size > 0) {
    const sortedImports = Array.from(imports).sort();
    lines.push(`import { ${sortedImports.join(", ")} } from "../enums";`);
  }

  lines.push("");

  // Generate schema using the shared generateType function
  const fields = zodObject.fields
    .map((field) => `  ${field.name}: ${generateType(field.type)}`)
    .join(",\n");

  if (zodObject.documentation) {
    lines.push(`// ${zodObject.documentation}`);
  }

  lines.push(`export const ${zodObject.name}Schema = z.object({`);
  lines.push(fields);
  lines.push(`});`);
  lines.push(``);
  lines.push(`// Type inference from schema: ${zodObject.name}`);
  lines.push(`export type ${zodObject.name} = z.infer<typeof ${zodObject.name}Schema>;`);

  return lines.join("\n") + "\n";
}

/**
 * Generates enum file content
 */
function generateEnumFile(zodEnum: ZodEnum): string {
  const lines: string[] = [];

  lines.push(`import { z } from "zod";`);
  lines.push("");

  const enumValues = zodEnum.values.map((v) => `"${v}"`).join(", ");

  if (zodEnum.documentation) {
    lines.push(`// ${zodEnum.documentation}`);
  }

  lines.push(`export const ${zodEnum.name}Schema = z.enum([${enumValues}]);`);
  lines.push(``);
  lines.push(`// Type inference from schema: ${zodEnum.name}`);
  lines.push(`export type ${zodEnum.name} = z.infer<typeof ${zodEnum.name}Schema>;`);

  return lines.join("\n") + "\n";
}



/**
 * Analyzes which enums a model uses
 */
function getEnumDependencies(
  zodObject: ZodObject,
  allEnums: ReadonlyArray<ZodEnum>
): Set<string> {
  const deps = new Set<string>();
  const enumNames = new Set(allEnums.map(e => e.name));

  function checkType(type: import("~/domain/zod-ast").ZodType): void {
    if (type._tag === "ZodEnum" && enumNames.has(type.name)) {
      deps.add(`${type.name}Schema`);
    } else if (type._tag === "ZodOptional" || type._tag === "ZodNullable" || type._tag === "ZodDefault") {
      checkType(type.inner);
    } else if (type._tag === "ZodArray") {
      checkType(type.element);
    }
  }

  for (const field of zodObject.fields) {
    checkType(field.type);
  }

  return deps;
}

/**
 * Generates all files for modular output
 */
export function generateModularFiles(
  schema: ZodSchema,
  options: ModularGenerationOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const { baseDir, groups } = options;

  // Organize enums and models by group
  const modelsByGroup = new Map<string, ZodObject[]>();
  const enumsByGroup = new Map<string, ZodEnum[]>();

  for (const group of groups) {
    modelsByGroup.set(group.name, []);
    enumsByGroup.set(group.name, []);
  }

  // Assign models to groups
  for (const obj of schema.objects) {
    for (const group of groups) {
      if (group.models.includes(obj.name)) {
        modelsByGroup.get(group.name)!.push(obj);
        break;
      }
    }
  }

  // Assign enums to groups
  for (const enumDef of schema.enums) {
    for (const group of groups) {
      if (group.enums.includes(enumDef.name)) {
        enumsByGroup.get(group.name)!.push(enumDef);
        break;
      }
    }
  }

  // Generate enum files (always in enums/)
  const allEnumsInEnumsFolder = schema.enums;
  for (const enumDef of allEnumsInEnumsFolder) {
    const fileName = toKebabCase(enumDef.name);
    files.push({
      path: `${baseDir}/enums/${fileName}.ts`,
      content: generateEnumFile(enumDef),
    });
  }

  // Generate enums index
  files.push({
    path: `${baseDir}/enums/index.ts`,
    content: generateEnumsIndex(schema.enums.map(e => e.name)),
  });

  // Generate model files for each group
  for (const [groupName, models] of modelsByGroup.entries()) {
    if (groupName === "enums") continue;

    for (const model of models) {
      const fileName = toKebabCase(model.name);
      const imports = getEnumDependencies(model, schema.enums);

      files.push({
        path: `${baseDir}/${groupName}/${fileName}.schema.ts`,
        content: generateSchemaFile(model, imports),
      });
    }

    // Generate module index
    const group = groups.find(g => g.name === groupName)!;
    files.push({
      path: `${baseDir}/${groupName}/index.ts`,
      content: generateModuleIndex(group),
    });
  }

  // Generate root index
  files.push({
    path: `${baseDir}/index.ts`,
    content: generateRootIndex(groups),
  });

  return files;
}
