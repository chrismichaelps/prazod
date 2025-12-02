/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Context } from "effect";
import type { PrismaSchema } from "~/domain/prisma-ast";
import type { GenerationError } from "~/domain/errors";

// Prisma generator service interface
export interface PrismaGenerator {
  readonly generate: (
    schema: PrismaSchema
  ) => Effect.Effect<string, GenerationError>;

  readonly format: (
    code: string
  ) => Effect.Effect<string, GenerationError>;
}

// Service tag for dependency injection
export const PrismaGenerator = Context.GenericTag<PrismaGenerator>("PrismaGenerator");
