/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Context } from "effect";
import type { ZodSchema } from "~/domain/zod-ast";
import type { GenerationError } from "~/domain/errors";

// Zod generator service interface
export interface ZodGenerator {
  readonly generate: (
    schema: ZodSchema
  ) => Effect.Effect<string, GenerationError>;

  readonly format: (
    code: string
  ) => Effect.Effect<string, GenerationError>;
}

// Service tag for dependency injection
export const ZodGenerator = Context.GenericTag<ZodGenerator>("ZodGenerator");
