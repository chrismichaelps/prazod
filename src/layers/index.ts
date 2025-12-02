/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import { Layer } from "effect";
import { FileSystemLive } from "~/adapters/node-file-system";
import { PrismaParserLive } from "~/parsing/prisma";
import { ZodGeneratorLive } from "~/parsing/zod";
import { PrismaGeneratorLive } from "~/adapters/prisma-generator-impl";
import { SyncService } from "~/context";
import { makeSyncService } from "~/services/sync";
export { SyncService };

// AppLayer
// Base services that SyncService depends on
const BaseLayer = Layer.mergeAll(
  FileSystemLive,
  PrismaParserLive,
  ZodGeneratorLive,
  PrismaGeneratorLive
);

// Create SyncService with its dependencies provided
const SyncServiceLayer = Layer.effect(SyncService, makeSyncService).pipe(
  Layer.provide(BaseLayer)
);

// App Layer
export const AppLayer = Layer.mergeAll(BaseLayer, SyncServiceLayer);
