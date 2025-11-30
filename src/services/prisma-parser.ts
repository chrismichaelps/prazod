/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Context } from "effect";
import type { PrismaSchema } from "~/domain/prisma-ast";
import type { ParseError } from "~/domain/errors";

// Prisma parser service interface
export interface PrismaParser {
  readonly parse: (
    schema: string
  ) => Effect.Effect<PrismaSchema, ParseError>;

  readonly validate: (
    schema: PrismaSchema
  ) => Effect.Effect<void, ReadonlyArray<ParseError>>;
}

// Service tag for dependency injection
export const PrismaParser = Context.GenericTag<PrismaParser>("PrismaParser");
