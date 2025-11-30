/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Effect } from "effect";
import type { AppConfig } from "~/config";
import { AppLayer } from "~/layers";
import { generateCommand } from "~/cli/commands/generate";
import type { AppError } from "~/domain/errors";

// Parse command-line arguments
const args = process.argv.slice(2);

// Check for --modular flag
const modularIndex = args.indexOf("--modular");
const isModular = modularIndex !== -1;
if (isModular) {
  args.splice(modularIndex, 1); // Remove flag from args
}

// Validate remaining arguments
const unknownFlags = args.filter(arg => arg.startsWith("--"));
if (unknownFlags.length > 0) {
  console.error(`Error: Unknown option(s): ${unknownFlags.join(", ")}`);
  console.error(`Usage: prazod [prisma-schema-path] [output-path] [options]`);
  console.error(`Options:`);
  console.error(`  --modular    (Optional) Generate modular multi-file output`);
  process.exit(1);
}

const prismaPath = args[0] || process.env.SCHEMA_PATH || "./prisma/schema.prisma";
const zodPath = args[1] || process.env.OUTPUT_PATH || (isModular ? "./src/zod-schemas" : "./src/zod-schemas.ts");

const config: AppConfig = {
  prismaPath,
  zodPath,
  modular: isModular,
};

const main = Effect.gen(function* (_) {
  return yield* _(generateCommand(config));
}).pipe(Effect.provide(AppLayer)) as Effect.Effect<void, AppError, never>;
Effect.runPromise(main).catch((error: unknown) => {
  if (error && typeof error === "object" && "_tag" in error) {
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.error(JSON.stringify({ _tag: "FatalError", message: String(error) }, null, 2));
  }
  process.exit(1);
});
