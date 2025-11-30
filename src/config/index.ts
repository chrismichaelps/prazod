/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Config } from "effect";

export interface AppConfig {
  readonly prismaPath: string;
  readonly zodPath: string;
  readonly modular?: boolean;
}

export const AppConfig = Config.map(
  Config.all([
    Config.string("SCHEMA_PATH").pipe(
      Config.withDefault("./prisma/schema.prisma")
    ),
    Config.string("OUTPUT_PATH").pipe(Config.withDefault("./src/zod-schemas.ts")),
  ]),
  ([prismaPath, zodPath]) => ({
    prismaPath,
    zodPath,
  })
);
