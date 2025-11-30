/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect, Layer } from "effect";
import * as fs from "node:fs/promises";
import { FileSystem } from "~/context";
import { FileReadError, FileWriteError } from "~/domain/errors";

// Node.js file system
export const FileSystemLive = Layer.succeed(
  FileSystem,
  FileSystem.of({
    readFile: (path: string) =>
      Effect.tryPromise({
        try: () => fs.readFile(path, "utf-8"),
        catch: (error) =>
          new FileReadError({
            path,
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof Error && { cause: error }),
          }),
      }),

    writeFile: (path: string, content: string) =>
      Effect.tryPromise({
        try: () => fs.writeFile(path, content, "utf-8"),
        catch: (error) =>
          new FileWriteError({
            path,
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof Error && { cause: error }),
          }),
      }),

    exists: (path: string) =>
      Effect.tryPromise({
        try: async () => {
          try {
            await fs.access(path);
            return true;
          } catch {
            return false;
          }
        },
        catch: (error) =>
          new FileReadError({
            path,
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof Error && { cause: error }),
          }),
      }),

    makeDirectory: (path: string, options?: { recursive?: boolean }) =>
      Effect.tryPromise({
        try: () => fs.mkdir(path, options),
        catch: (error) =>
          new FileWriteError({
            path,
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof Error && { cause: error }),
          }),
      }),
  })
);
