#!/usr/bin/env tsx
/**
 * Validate Prisma schemas using Prisma's internals
 */

import { getDMMF } from '@prisma/internals';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const schemas = [
  'examples/social-media-describe.prisma',
  'examples/ecommerce-inferred.prisma',
  'examples/complex-schema.prisma',
];

async function validateSchema(schemaPath: string): Promise<boolean> {
  try {
    const fullPath = resolve(schemaPath);
    const schema = readFileSync(fullPath, 'utf-8');

    console.log(`\n✓ Validating ${schemaPath}...`);

    // This will throw if the schema is invalid
    await getDMMF({ datamodel: schema });

    console.log(`  ✅ Valid!`);
    return true;
  } catch (error) {
    console.log(`  ❌ Invalid!`);
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Validating Prisma schemas...\n');

  const results = await Promise.all(schemas.map(validateSchema));

  const allValid = results.every(r => r);

  console.log('\n' + '='.repeat(50));
  if (allValid) {
    console.log('✅ All schemas are valid!');
    process.exit(0);
  } else {
    console.log('❌ Some schemas have errors!');
    process.exit(1);
  }
}

main();
