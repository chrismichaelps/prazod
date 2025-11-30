/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Context } from "effect";
import type { FileSystemError } from "~/domain/errors";

// File system service interface
export interface FileSystem {
  readonly readFile: (
    path: string
  ) => Effect.Effect<string, FileSystemError>;

  readonly writeFile: (
    path: string,
    content: string
  ) => Effect.Effect<void, FileSystemError>;

  readonly fileExists: (
    path: string
  ) => Effect.Effect<boolean, FileSystemError>;
}

// Service tag for dependency injection
export const FileSystem = Context.GenericTag<FileSystem>("FileSystem");
