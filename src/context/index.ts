/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Context } from "effect";
import type { Effect } from "effect";
import type { PlatformError } from "@effect/platform/Error";
import type { PrismaSchema } from "~/domain/prisma-ast";
import type { ZodSchema } from "~/domain/zod-ast";
import type { ParseError, GenerationError, FileSystemError } from "~/domain/errors";

// FileSystem Service Tag
export interface FileSystem {
  readonly readFile: (path: string) => Effect.Effect<string, FileSystemError>;
  readonly writeFile: (
    path: string,
    content: string
  ) => Effect.Effect<void, FileSystemError>;
  readonly exists: (path: string) => Effect.Effect<boolean, FileSystemError>;
  readonly makeDirectory: (
    path: string,
    options?: { recursive?: boolean }
  ) => Effect.Effect<void, FileSystemError>;
}

export const FileSystem = Context.GenericTag<FileSystem>("FileSystem");

// PrismaParser Service Tag
export interface PrismaParser {
  readonly parse: (
    schema: string
  ) => Effect.Effect<PrismaSchema, ParseError>;
  readonly validate: (
    schema: PrismaSchema
  ) => Effect.Effect<void, ParseError>;
}

export const PrismaParser = Context.GenericTag<PrismaParser>("PrismaParser");

// ZodGenerator Service Tag
export interface ZodGenerator {
  readonly generate: (
    schema: ZodSchema
  ) => Effect.Effect<string, GenerationError>;
  readonly format: (code: string) => Effect.Effect<string, GenerationError>;
}

export const ZodGenerator = Context.GenericTag<ZodGenerator>("ZodGenerator");

// SyncService Tag
export interface SyncConfig {
  readonly prismaPath: string;
  readonly zodPath: string;
  readonly modular?: boolean; // Generate modular folder structure
}

export interface SyncStats {
  readonly modelsProcessed: number;
  readonly enumsProcessed: number;
}

export interface SyncService {
  readonly sync: (
    config: SyncConfig
  ) => Effect.Effect<SyncStats, ParseError | GenerationError | FileSystemError | PlatformError>;
}

export const SyncService = Context.GenericTag<SyncService>("SyncService");
