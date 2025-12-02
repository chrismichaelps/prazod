# Prazod
A CLI that keeps your Zod schemas in sync with your Prisma models. It generates modular, type-safe validation files automatically, ensuring your database and application logic stay aligned.

### Current Status

⚠️ **This is a proof of concept (POC)** - The library is currently in active development and should be used for experimental purposes. While functional, it may not be production-ready for all use cases.

[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.me/chrismperezsantiago)

> **Support the Project**
>
> To keep this library maintained and evolving, your contribution would be greatly appreciated! It helps keep me motivated to continue collaborating and improving this framework for everyone.
>
> [**Donate via PayPal**](https://www.paypal.me/chrismperezsantiago)

## Prerequisites

- [x] `Node.js >= 22.0.0`
- [x] `Yarn >= 1.x`

# 📚 Documentation

## **:package: Installation**

```shell
# Global install (once)
npm install -g prazod   # or pnpm add -g prazod
```

```shell
# Run without installing (npx)
npx prazod schema.prisma output.ts --modular
```

## Reverse Generation (Zod -> Prisma)

Prazod also supports generating a Prisma schema from existing Zod schemas. This is useful when you want to prototype with Zod first or migrate an existing Zod-based project to Prisma.

```bash
# Generate Prisma schema from Zod file
prazod reverse ./src/zod-schemas.ts ./prisma/schema.prisma
```

### Supported Features

- **Models**: Zod objects are converted to Prisma models.
- **Enums**: Zod enums are converted to Prisma enums.
- **Attributes**:
  - `@id`: Inferred from `id` field or `.cuid()`/`.uuid()` validations.
  - `@default`: Inferred from `.default()` values.
  - `@updatedAt`: Inferred from `updatedAt` field name.
  - `@unique`: Inferred from `.describe("@unique")`.
  - `@relation`: Parsed from `.describe()` (e.g., `.describe("@relation(fields: [userId], references: [id])")`).
  - `@map`: Parsed from `.describe()` (e.g., `.describe('@map("column_name")')`).
  - Native Types: Parsed from `.describe()` (e.g., `.describe("@db.Text")`).
- **Model Attributes**:
  - `@@index`: Parsed from model documentation.
  - `@@id`: Parsed from model documentation (for composite IDs).
  - `@@unique`: Parsed from model documentation (for composite unique constraints).
  - `@@fulltext`: Parsed from model documentation (for full-text search indexes).
  - `@@map`: Parsed from model documentation.
- **Types**:
  - `z.string()` -> `String`
  - `z.number()` -> `Float` (or `Int` if `.int()` is used)
  - `z.boolean()` -> `Boolean`
  - `z.date()` -> `DateTime`
  - `z.enum()` -> `Enum`
  - `z.lazy(() => Model)` -> `Model` (for relations)

### Limitations

- **Database Provider**: Defaults to `postgresql`. You may need to adjust the `datasource` block manually.
```shell
# Local dev dependency (recommended for projects)
pm install --save-dev prazod   # or pnpm add -D prazod
```

Add the script to your package.json:
```json
{
  "scripts": {
    "generate:zod": "prazod prisma/schema.prisma src/zod-schemas --modular"
  }
}
```

## **:rocket: Usage**

### Single File Mode (Default)
```shell
prazod examples/ecommerce.prisma output.ts
```

### Modular Mode
Generate organized folder structure with separate files:
```shell
prazod examples/ecommerce.prisma output-dir --modular
```

### Examples

Check out the `examples/` directory for sample Prisma schemas:
- [`examples/ecommerce.prisma`](examples/ecommerce.prisma) - Comprehensive e-commerce schema
- [`examples/test-features.prisma`](examples/test-features.prisma) - Feature test schema (default functions, ignore attributes)

For local development:
```shell
pnpm build && node dist/index.js examples/ecommerce.prisma examples/ecommerce-zod --modular
```


## **:sparkles: Supported Prisma Features**

### Scalar Types
All Prisma scalar types are fully supported:
- `String`, `Int`, `BigInt`, `Float`, `Decimal`
- `Boolean`, `DateTime`, `Json`, `Bytes`

### Default Value Functions
- `autoincrement()` - Auto-incrementing integers
- `now()` - Current timestamp
- `uuid()` - UUID v4 generation
- `cuid()` - Collision-resistant ID
- `auto()` - MongoDB ObjectId (auto-generated)
- `sequence()` - CockroachDB sequences with options
- `ulid()` - Lexicographically sortable IDs
- `nanoid()` - Nano IDs with custom length
- `dbgenerated()` - Database-level default expressions

### Field Attributes
- `@id` - Primary key
- `@unique` - Unique constraint
- `@default` - Default value
- `@updatedAt` - Automatic update timestamp
- `@relation` - Define relationships
- `@map` - Column name mapping
- `@ignore` - Exclude from Zod schema (field will be omitted)

### Model Attributes
- `@@id` - Composite primary key
- `@@unique` - Composite unique constraint
- `@@index` - Database index
- `@@map` - Table name mapping
- `@@ignore` - Exclude model from Zod schemas (file will not be generated)

### Relations
- One-to-one, one-to-many, and many-to-many relationships
- Self-relations and bi-directional relations
- Relation actions: `Cascade`, `Restrict`, `NoAction`, `SetNull`

### Enums
Full enum support with proper Zod enum generation


## **:handshake: Contributing**

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting pull requests.

**Quick start:**
- Fork it!
- Create your feature branch: `git checkout -b my-new-feature`
- Commit your changes: `git commit -am 'Add some feature'`
- Push to the branch: `git push origin my-new-feature`
- Submit a pull request

---

### **:busts_in_silhouette: Credits**

- [Chris Michael](https://github.com/chrismichaelps) (Project Leader, and Developer)

---

### **:anger: Troubleshootings**

This is just a personal project created for study / demonstration purpose and to simplify my working life, it may or may
not be a good fit for your project(s).

---

### **:heart: Show your support**

Please :star: this repository if you like it or this project helped you!\
Feel free to open issues or submit pull-requests to help me improving my work.

---

### **:robot: Author**

_*Chris M. Perez*_

> You can follow me on
> [github](https://github.com/chrismichaelps)&nbsp;&middot;&nbsp;[twitter](https://twitter.com/Chris5855M)

---

Copyright ©2025 [prazod](https://github.com/chrismichaelps/prazod).
