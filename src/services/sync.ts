/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect } from "effect";
import { FileSystem, PrismaParser, ZodGenerator, SyncService } from "~/context";
import { prismaToZod } from "~/parsing/transformers";
import { groupByDomain } from "~/parsing/module-grouping";
import { generateModularFiles } from "~/parsing/modular-generator";
import { writeModularFiles } from "~/parsing/file-writer";
import type { SyncConfig, SyncStats } from "~/context";
import type { ParseError, GenerationError, FileSystemError } from "~/domain/errors";

// Sync service
export const makeSyncService = Effect.gen(function* (_) {
  const fs = yield* _(FileSystem);
  const parser = yield* _(PrismaParser);
  const generator = yield* _(ZodGenerator);

  return SyncService.of({
    sync: (config: SyncConfig) =>
      Effect.gen(function* (_) {
        // 1. Read Prisma schema
        const schemaContent = yield* _(fs.readFile(config.prismaPath));

        // 2. Parse and validate schema
        const prismaSchema = yield* _(parser.parse(schemaContent));
        yield* _(parser.validate(prismaSchema));

        // 3. Transform to Zod AST
        const zodSchema = prismaToZod(prismaSchema);

        // 4. Generate Zod code
        if (config.modular) {
          // Group models by domain
          const groups = groupByDomain(zodSchema);

          // Generate files
          const files = generateModularFiles(zodSchema, {
            baseDir: config.zodPath,
            groups
          });

          // Write files
          yield* _(writeModularFiles(files));
        } else {
          const code = yield* _(generator.generate(zodSchema));
          const formattedCode = yield* _(generator.format(code));
          yield* _(fs.writeFile(config.zodPath, formattedCode));
        }

        return {
          modelsProcessed: prismaSchema.models.length,
          enumsProcessed: prismaSchema.enums.length,
        };
      }) as Effect.Effect<SyncStats, ParseError | GenerationError | FileSystemError>,
  });
});
