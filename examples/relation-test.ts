import { z } from "zod";

/**
 * User Model
 * Tests 1:1 relation with Profile
 */
export const User = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  /**
   * @unique
   */
  email: z.string().email(),

  name: z.string(),

  /**
   * @default(now())
   */
  createdAt: z.date(),

  // 1:1 relation with Profile (back relation)
  profile: z.lazy(() => Profile).optional().describe("@relation"),

  // 1:n relation with Post
  posts: z.array(z.lazy(() => Post)).describe("@relation"),
});

/**
 * Profile Model
 * 1:1 relationship with User
 */
export const Profile = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  bio: z.string().optional(),

  // Use .describe() for Prisma attributes instead of JSDoc comments
  // JSDoc comments are compile-time only and won't be available at runtime
  userId: z.string().describe("@unique"),

  // 1:1 relation to User (forward relation with FK)
  user: z.lazy(() => User).describe("@relation(fields: [userId], references: [id])"),
});

/**
 * Category Model
 * Tests self-referential relation
 */
export const Category = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  name: z.string(),

  slug: z.string(),

  // Self-referential relation
  parentId: z.string().nullable().optional(),
  parent: z.lazy(() => Category).nullable().optional().describe('@relation("CategoryTree", fields: [parentId], references: [id])'),
  children: z.array(z.lazy(() => Category)).describe('@relation("CategoryTree")'),
});

/**
 * Post Model
 */
export const Post = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  title: z.string(),

  /**
   * @db.Text
   */
  content: z.string(),

  published: z.boolean().default(false),

  userId: z.string(),
  user: z.lazy(() => User).describe("@relation(fields: [userId], references: [id])"),

  /**
   * @default(now())
   */
  createdAt: z.date(),
});
