## [1.0.1](https://github.com/chrismichaelps/prazod/compare/v1.0.0...v1.0.1) (2025-11-30)

### Bug Fixes

* remove test step from prepublishOnly to fix CI release ([1f8ef88](https://github.com/chrismichaelps/prazod/commit/1f8ef888b895ed7b9befd53cf3224f1397bbed4b))

## 1.0.0 (2025-11-30)

### Features

* Set up automated release process with semantic-release and GitHub Actions, including initial changelog. ([1f10d91](https://github.com/chrismichaelps/prazod/commit/1f10d91d0ce7ec154a482d9157dffc6beeedd964))

# Changelog

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

---

## 0.1.0 (Current Development Version)

### Current Status

**WARNING: Proof of Concept (POC)** - This library is currently in active development and should be used for experimental purposes. While functional, it may not be production-ready for all use cases.

### Features

#### Core Functionality
- **Prisma to Zod Schema Generation** - Automatically generate type-safe Zod schemas from Prisma models
- **Single File Mode** - Generate all schemas in a single file
- **Modular Mode** - Generate organized folder structure with separate files per model
- **CLI Interface** - Simple command-line interface powered by Effect
- **Factory Pattern Architecture** - Clean, maintainable code using factory pattern for type mapping and attribute generation

#### Supported Prisma Features

##### Scalar Types
All Prisma scalar types are fully supported:
- `String`, `Int`, `BigInt`, `Float`, `Decimal`
- `Boolean`, `DateTime`, `Json`, `Bytes`

##### Default Value Functions
- `autoincrement()` - Auto-incrementing integers
- `now()` - Current timestamp
- `uuid()` - UUID v4 generation
- `cuid()` - Collision-resistant ID
- `auto()` - MongoDB ObjectId (auto-generated)
- `sequence()` - CockroachDB sequences with options
- `ulid()` - Lexicographically sortable IDs
- `nanoid()` - Nano IDs with custom length
- `dbgenerated()` - Database-level default expressions

##### Field Attributes
- `@id` - Primary key
- `@unique` - Unique constraint
- `@default` - Default value
- `@updatedAt` - Automatic update timestamp
- `@relation` - Define relationships
- `@map` - Column name mapping
- `@ignore` - Exclude from Zod schema (field will be omitted)

##### Model Attributes
- `@@id` - Composite primary key
- `@@unique` - Composite unique constraint
- `@@index` - Database index
- `@@map` - Table name mapping
- `@@ignore` - Exclude model from Zod schemas (file will not be generated)

##### Relations
- One-to-one, one-to-many, and many-to-many relationships
- Self-relations and bi-directional relations
- Relation actions: `Cascade`, `Restrict`, `NoAction`, `SetNull`

##### Enums
- Full enum support with proper Zod enum generation

#### Technical Details

##### Dependencies
- **Effect.js** - Functional error handling and application structure
- **Prisma Internals** - Schema parsing via DMMF
- **Zod** - Runtime type validation
- **TypeScript** - Type safety throughout

##### Architecture
- Factory pattern for default value parsing
- Factory pattern for attribute generation
- Factory pattern for type mapping
- Service-oriented architecture with dependency injection
- Comprehensive test suite with 63+ tests

### Installation

```bash
# Global install
npm install -g prazod

# Run without installing
npx prazod schema.prisma output.ts --modular

# Local dev dependency (recommended)
npm install --save-dev prazod
```

### Usage

**Single File Mode:**
```bash
prazod examples/ecommerce.prisma output.ts
```

**Modular Mode:**
```bash
prazod examples/ecommerce.prisma output-dir --modular
```

### Requirements

- Node.js >= 22.0.0
- Yarn >= 1.x or pnpm

---

## Future Releases

Future releases will be automatically documented here by semantic-release based on [Conventional Commits](https://www.conventionalcommits.org/).
