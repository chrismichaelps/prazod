/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Data } from "effect";

// File System Errors
export class FileNotFoundError extends Data.TaggedError("FileNotFound")<{
  path: string;
}> { }

export class PermissionDeniedError extends Data.TaggedError("PermissionDenied")<{
  path: string;
}> { }

export class InvalidPathError extends Data.TaggedError("InvalidPath")<{
  path: string;
  reason: string;
}> { }

export class FileReadError extends Data.TaggedError("FileReadError")<{
  path: string;
  message: string;
  cause?: Error;
}> { }

export class FileWriteError extends Data.TaggedError("FileWriteError")<{
  path: string;
  message: string;
  cause?: Error;
}> { }

export type FileSystemError =
  | FileNotFoundError
  | PermissionDeniedError
  | InvalidPathError
  | FileReadError
  | FileWriteError;

// Parse Errors
export class SyntaxError extends Data.TaggedError("SyntaxError")<{
  line: number;
  column: number;
  message: string;
  cause?: Error;
}> { }

export class InvalidModelError extends Data.TaggedError("InvalidModel")<{
  modelName: string;
  reason: string;
}> { }

export class UnknownTypeError extends Data.TaggedError("UnknownType")<{
  typeName: string;
  field: string;
  modelName: string;
}> { }

export class CircularDependencyError extends Data.TaggedError("CircularDependency")<{
  models: string[];
}> { }

export type ParseError =
  | SyntaxError
  | InvalidModelError
  | UnknownTypeError
  | CircularDependencyError;

// Generation Errors
export class UnsupportedFeatureError extends Data.TaggedError("UnsupportedFeature")<{
  feature: string;
  context: string;
}> { }

export class ValidationError extends Data.TaggedError("ValidationError")<{
  field?: string;
  value?: unknown;
  expected?: string;
  message: string;
  cause?: Error;
}> { }

export class CodeGenerationError extends Data.TaggedError("CodeGenerationError")<{
  modelName: string;
  reason: string;
  cause?: Error;
}> { }

export type GenerationError =
  | UnsupportedFeatureError
  | ValidationError
  | CodeGenerationError;

import type { PlatformError } from "@effect/platform/Error";

// App Error Type
export type AppError = FileSystemError | ParseError | GenerationError | PlatformError;
