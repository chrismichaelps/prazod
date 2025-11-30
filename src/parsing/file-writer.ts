/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect } from "effect";
import { FileSystem } from "~/context";
import type { FileSystemError } from "~/domain/errors";
import type { GeneratedFile } from "./modular-generator";

/**
 * Writes multiple files to the file system, creating directories as needed
 */
export function writeModularFiles(
  files: ReadonlyArray<GeneratedFile>
): Effect.Effect<void, FileSystemError, FileSystem> {
  return Effect.gen(function* (_) {
    const fs = yield* _(FileSystem);

    for (const file of files) {
      // Extract directory path
      const lastSlash = file.path.lastIndexOf("/");
      const dir = file.path.substring(0, lastSlash);

      // Create directory if it doesn't exist
      yield* _(fs.makeDirectory(dir, { recursive: true }));

      // Write file
      yield* _(fs.writeFile(file.path, file.content));
    }
  });
}
