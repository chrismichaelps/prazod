/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Layer } from "effect";
import { PrismaGenerator } from "~/services/prisma-generator";
import type { PrismaSchema } from "~/domain/prisma-ast";
import type { GenerationError } from "~/domain/errors";
import { CodeGenerationError } from "~/domain/errors";
import { generatePrismaCode } from "~/parsing/prisma-code-generator";

export const PrismaGeneratorLive = Layer.succeed(
  PrismaGenerator,
  PrismaGenerator.of({
    generate: (schema: PrismaSchema) =>
      Effect.try({
        try: () => generatePrismaCode(schema),
        catch: (error): GenerationError =>
          new CodeGenerationError({
            modelName: "schema",
            reason: error instanceof Error ? error.message : String(error),
            ...(error instanceof Error && { cause: error }),
          }),
      }),

    format: (code: string) =>
      Effect.succeed(code),
  })
);
