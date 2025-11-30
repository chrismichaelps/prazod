/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Console } from "effect";
import { SyncService } from "~/context";
import type { SyncConfig } from "~/context";
import type { AppError } from "~/domain/errors";

// Generate command
export const generateCommand = (
  config: SyncConfig
): Effect.Effect<void, AppError, SyncService> =>
  Effect.gen(function* (_) {
    const sync = yield* _(SyncService);

    yield* _(Console.log(` Syncing Prisma to Zod...`));
    yield* _(Console.log(`  Prisma: ${config.prismaPath}`));
    yield* _(Console.log(`  Zod: ${config.zodPath}`));
    yield* _(Console.log(`  Mode: ${config.modular ? "Modular (Multi-file)" : "Single File"}`));

    const result = yield* _(sync.sync(config));

    yield* _(Console.log(""));
    yield* _(Console.log("Sync complete!"));
    yield* _(Console.log(`  Models: ${result.modelsProcessed}`));
    yield* _(Console.log(`  Enums: ${result.enumsProcessed}`));
  });

// Format error for display
export function formatError(error: AppError): string {
  switch (error._tag) {
    case "FileNotFound":
      return ` File not found: ${error.path}`;
    case "PermissionDenied":
      return ` Permission denied: ${error.path}`;
    case "InvalidPath":
      return ` Invalid path: ${error.path}\n   ${error.reason}`;
    case "SyntaxError":
      return (
        ` Syntax error at line ${error.line}, column ${error.column}:\n` +
        `   ${error.message}`
      );
    case "InvalidModel":
      return ` Invalid model "${error.modelName}": ${error.reason}`;
    case "UnknownType":
      return (
        ` Unknown type "${error.typeName}" ` +
        `in field "${error.field}" of model "${error.modelName}"`
      );
    case "CircularDependency":
      return (
        ` Circular dependency detected:\n` +
        `   ${error.models.join(" → ")}`
      );
    case "ValidationError":
      return ` Validation error in "${error.field}": ${error.message}`;
    case "CodeGenerationError":
      return ` Code generation error in "${error.modelName}": ${error.reason}`;
    case "UnsupportedFeature":
      return ` Unsupported feature "${error.feature}" in ${error.context}`;
    case "FileReadError":
      return ` Read error: ${error.path}\n   ${error.message}`;
    case "FileWriteError":
      return ` Write error: ${error.path}\n   ${error.message}`;
    case "BadArgument":
      return ` Bad argument: ${error.message}`;
    case "SystemError":
      return ` System error: ${error.reason} (${error.message})`;
    default:
      return ` Unknown error: ${JSON.stringify(error)}`;
  }
}
