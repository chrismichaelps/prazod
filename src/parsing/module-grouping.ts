/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import type { ZodSchema } from "~/domain/zod-ast";
import { toTitleCase, pluralize } from "~/utils/string-utils";

/**
 * Represents a group of related models organized by domain
 */
export interface ModuleGroup {
  readonly name: string;
  readonly displayName: string;
  readonly models: ReadonlyArray<string>;
  readonly enums: ReadonlyArray<string>;
}

/**
 * Configuration for custom domain grouping
 */
export interface DomainConfig {
  readonly domains?: Record<string, {
    readonly models?: string[];
    readonly enums?: string[];
  }>;
}

/**
 * Groups models by analyzing their names and relationships dynamically
 */
export function groupByDomain(
  schema: ZodSchema,
  config?: DomainConfig
): ModuleGroup[] {
  const groups = new Map<string, { models: Set<string>; enums: Set<string> }>();

  // Helper to get or create a group
  const getGroup = (domain: string) => {
    if (!groups.has(domain)) {
      groups.set(domain, { models: new Set(), enums: new Set() });
    }
    return groups.get(domain)!;
  };

  // Apply config-based grouping first (highest priority)
  const assignedModels = new Set<string>();
  const assignedEnums = new Set<string>();

  if (config?.domains) {
    for (const [domain, items] of Object.entries(config.domains)) {
      const group = getGroup(domain);
      items.models?.forEach(m => {
        group.models.add(m);
        assignedModels.add(m);
      });
      items.enums?.forEach(e => {
        group.enums.add(e);
        assignedEnums.add(e);
      });
    }
  }

  // Build relationship graph for unassigned models
  const relationshipGraph = buildRelationshipGraph(schema);

  // Group related models together using clustering
  const modelClusters = clusterByRelationships(
    schema.objects
      .filter(obj => !assignedModels.has(obj.name))
      .map(obj => obj.name),
    relationshipGraph
  );

  // Assign clustered models to domains
  for (const cluster of modelClusters) {
    const domainName = inferDomainName(cluster);
    const group = getGroup(domainName);
    cluster.forEach(model => {
      group.models.add(model);
      assignedModels.add(model);
    });
  }

  // Group enums by usage in models
  for (const enumDef of schema.enums) {
    if (assignedEnums.has(enumDef.name)) continue;

    // Find which models use this enum
    const usingModels = findModelsUsingEnum(schema, enumDef.name);

    if (usingModels.length > 0) {
      // Assign to the same domain as the first model that uses it
      const firstModel = usingModels[0]!;
      for (const [domain, { models }] of groups.entries()) {
        if (models.has(firstModel)) {
          groups.get(domain)!.enums.add(enumDef.name);
          assignedEnums.add(enumDef.name);
          break;
        }
      }
    } else {
      // Standalone enum - create its own domain or put in "common"
      getGroup("common").enums.add(enumDef.name);
      assignedEnums.add(enumDef.name);
    }
  }

  // Convert to ModuleGroup array
  return Array.from(groups.entries())
    .map(([name, { models, enums }]) => ({
      name: name.toLowerCase(),
      displayName: toTitleCase(name),
      models: Array.from(models).sort(),
      enums: Array.from(enums).sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Builds a graph of model relationships
 */
function buildRelationshipGraph(schema: ZodSchema): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const obj of schema.objects) {
    const relations = new Set<string>();

    for (const field of obj.fields) {
      // Check if field references another model
      if (field.type._tag === "ZodObject" && field.type.name !== "Nested") {
        relations.add(field.type.name);
      }
      // Check arrays of models
      else if (field.type._tag === "ZodArray" && field.type.element._tag === "ZodObject") {
        relations.add(field.type.element.name);
      }
    }

    graph.set(obj.name, relations);
  }

  return graph;
}

/**
 * Clusters models based on their relationships using connected components
 */
function clusterByRelationships(
  models: string[],
  graph: Map<string, Set<string>>
): string[][] {
  const clusters: string[][] = [];
  const visited = new Set<string>();

  // Find connected components
  for (const model of models) {
    if (visited.has(model)) continue;

    const cluster: string[] = [];
    const queue = [model];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      cluster.push(current);

      // Add related models
      const relations = graph.get(current) || new Set();
      for (const related of relations) {
        if (!visited.has(related) && models.includes(related)) {
          queue.push(related);
        }
      }

      // Add models that reference this one (bidirectional)
      for (const [otherModel, otherRelations] of graph.entries()) {
        if (!visited.has(otherModel) && models.includes(otherModel) && otherRelations.has(current)) {
          queue.push(otherModel);
        }
      }
    }

    if (cluster.length > 0) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

/**
 * Infers a domain name from a cluster of related models
 */
function inferDomainName(models: string[]): string {
  if (models.length === 0) return "misc";
  if (models.length === 1) return models[0]!.toLowerCase();

  // Extract common prefixes/suffixes
  const commonTerms = extractCommonTerms(models);

  if (commonTerms.length > 0) {
    return commonTerms[0]!.toLowerCase();
  }

  // Use the first model name as fallback
  const firstModel = models[0];
  return firstModel ? pluralize(firstModel.toLowerCase()) : "misc";
}

/**
 * Extracts common terms from model names
 */
function extractCommonTerms(names: string[]): string[] {
  const allTerms = names.flatMap(name =>
    // Split PascalCase into words
    name.split(/(?=[A-Z])/).filter(Boolean)
  );

  // Count term frequency
  const termCounts = new Map<string, number>();
  for (const term of allTerms) {
    if (term) { // Skip empty strings
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    }
  }

  // Return terms that appear in multiple models
  return Array.from(termCounts.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .filter((term): term is string => Boolean(term)); // Type guard to ensure string
}

/**
 * Finds models that use a specific enum
 */
function findModelsUsingEnum(schema: ZodSchema, enumName: string): string[] {
  const models: string[] = [];

  for (const obj of schema.objects) {
    for (const field of obj.fields) {
      if (usesEnum(field.type, enumName)) {
        models.push(obj.name);
        break;
      }
    }
  }

  return models;
}

/**
 * Checks if a type uses a specific enum
 */
function usesEnum(type: import("~/domain/zod-ast").ZodType, enumName: string): boolean {
  if (type._tag === "ZodEnum" && type.name === enumName) {
    return true;
  }
  if (type._tag === "ZodOptional" || type._tag === "ZodNullable" || type._tag === "ZodDefault") {
    return usesEnum(type.inner, enumName);
  }
  if (type._tag === "ZodArray") {
    return usesEnum(type.element, enumName);
  }
  return false;
}


