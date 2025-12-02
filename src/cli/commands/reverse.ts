/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Console } from "effect";
import { FileSystem, PrismaGenerator } from "~/context";
import type { AppError } from "~/domain/errors";
import { parseZodSchema } from "~/parsing/zod-parser";
import { zodToPrisma } from "~/parsing/transformers";
import { z } from "zod";

export interface ReverseConfig {
  readonly zodPath: string;
  readonly prismaPath: string;
}

// Reverse command - converts Zod schemas to Prisma schema
export const reverseCommand = (
  config: ReverseConfig
): Effect.Effect<void, AppError, FileSystem | PrismaGenerator> =>
  Effect.gen(function* (_) {
    const fs = yield* _(FileSystem);
    const generator = yield* _(PrismaGenerator);

    yield* _(Console.log(` Reversing Zod to Prisma...`));
    yield* _(Console.log(`  Zod: ${config.zodPath}`));
    yield* _(Console.log(`  Prisma: ${config.prismaPath}`));

    // Dynamically import and evaluate the Zod file
    // This requires the Zod file to export named schemas
    const zodSchemas: Record<string, z.ZodTypeAny> = {};

    // Use dynamic import to load the TypeScript file
    const modulePath = config.zodPath.startsWith("/")
      ? config.zodPath
      : `${process.cwd()}/${config.zodPath}`;

    // Dynamic import
    const module = yield* _(
      Effect.tryPromise({
        try: async () => await import(modulePath),
        catch: (error) => {
          const { FileReadError } = require("~/domain/errors");
          return new FileReadError({
            path: config.zodPath,
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof Error && { cause: error }),
          });
        },
      })
    );

    // Extract exported Zod schemas
    for (const [key, value] of Object.entries(module)) {
      if (value && typeof value === "object" && "_def" in value) {
        zodSchemas[key] = value as z.ZodTypeAny;
      }
    }

    // Parse Zod schemas to AST
    const zodSchema = parseZodSchema(zodSchemas);

    // Transform to Prisma AST
    const prismaSchema = zodToPrisma(zodSchema);

    // Generate Prisma code
    const prismaCode = yield* _(generator.generate(prismaSchema));

    // Write to file
    yield* _(fs.writeFile(config.prismaPath, prismaCode));

    yield* _(Console.log(""));
    yield* _(Console.log(" Reverse generation complete!"));
    yield* _(Console.log(`  Models: ${prismaSchema.models.length}`));
    yield* _(Console.log(`  Enums: ${prismaSchema.enums.length}`));
  });
