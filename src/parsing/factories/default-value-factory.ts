/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { PRISMA_FUNCTIONS } from "~/domain/constants";
import type { PrismaDefaultValue } from "~/domain/prisma-ast";

type FunctionParser = (args: string[]) => PrismaDefaultValue;

const parsers: Record<string, FunctionParser> = {
  [PRISMA_FUNCTIONS.AutoIncrement]: () => ({ _tag: "AutoIncrement" }),
  [PRISMA_FUNCTIONS.Auto]: () => ({ _tag: "Auto" }),
  [PRISMA_FUNCTIONS.Now]: () => ({ _tag: "Now" }),
  [PRISMA_FUNCTIONS.Uuid]: () => ({ _tag: "Uuid" }),
  [PRISMA_FUNCTIONS.Cuid]: () => ({ _tag: "Cuid" }),
  [PRISMA_FUNCTIONS.Ulid]: () => ({ _tag: "Ulid" }),

  [PRISMA_FUNCTIONS.Nanoid]: (args) => {
    const length = args[0] ? parseInt(args[0], 10) : undefined;
    return length !== undefined
      ? { _tag: "Nanoid", length }
      : { _tag: "Nanoid" };
  },

  [PRISMA_FUNCTIONS.DbGenerated]: (args) => ({
    _tag: "DbGenerated",
    expression: args[0] || "",
  }),

  [PRISMA_FUNCTIONS.Sequence]: (args) => {
    const options: { start?: number; increment?: number } = {};

    args.forEach(arg => {
      const [key, value] = arg.split(":").map(s => s.trim());
      if (key === "start") options.start = parseInt(value!, 10);
      if (key === "increment") options.increment = parseInt(value!, 10);
    });

    return { _tag: "Sequence", options };
  },
};

// Parse DMMF default value object
export function createDefaultValue(value: unknown): PrismaDefaultValue {
  // Handle function calls like { name: "autoincrement", args: [] }
  if (typeof value === "object" && value !== null && "name" in value) {
    const obj = value as { name: string; args?: unknown[] };
    const functionName = obj.name;
    const args = Array.isArray(obj.args) ? obj.args.map(String) : [];

    const parser = parsers[functionName];
    if (parser) {
      return parser(args);
    }
  }

  // Handle literal values
  return { _tag: "Literal", value: value as string | number | boolean };
}
