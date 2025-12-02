import { z } from "zod";

/**
 * User Model
 * Central user entity
 */
export const User = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  username: z.string().describe("@unique"),
  email: z.string().email().describe("@unique"),

  /**
   * @db.Text
   */
  displayName: z.string(),

  /**
   * @default(now())
   */
  createdAt: z.date(),

  /**
   * @updatedAt
   */
  updatedAt: z.date(),

  // 1:1 relation
  profile: z.lazy(() => Profile).optional().describe("@relation"),

  // 1:n relations
  posts: z.array(z.lazy(() => Post)).describe("@relation"),
  comments: z.array(z.lazy(() => Comment)).describe("@relation"),
  likes: z.array(z.lazy(() => Like)).describe("@relation"),

  // Self-referential: users this user follows
  following: z.array(z.lazy(() => Follow)).describe('@relation("UserFollowing")'),

  // Self-referential: users following this user
  followers: z.array(z.lazy(() => Follow)).describe('@relation("UserFollowers")'),
});

/**
 * Profile Model
 * Extended user information (1:1 with User)
 */
export const Profile = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  /**
   * @db.Text
   */
  bio: z.string().optional(),

  avatarUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  location: z.string().optional(),

  /**
   * @default(now())
   */
  birthdate: z.date().optional(),

  userId: z.string().describe("@unique"),
  user: z.lazy(() => User).describe("@relation(fields: [userId], references: [id], onDelete: Cascade)"),
});

/**
 * Post Model
 * User-generated content
 */
export const Post = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  /**
   * @db.Text
   */
  content: z.string(),

  imageUrl: z.string().url().optional(),

  /**
   * @default(false)
   */
  published: z.boolean(),

  /**
   * @default(0)
   */
  viewCount: z.number().int(),

  /**
   * @default(now())
   */
  createdAt: z.date(),

  /**
   * @updatedAt
   */
  updatedAt: z.date(),

  // Author relation
  authorId: z.string(),
  author: z.lazy(() => User).describe("@relation(fields: [authorId], references: [id], onDelete: Cascade)"),

  // Relations
  comments: z.array(z.lazy(() => Comment)).describe("@relation"),
  likes: z.array(z.lazy(() => Like)).describe("@relation"),
  tags: z.array(z.lazy(() => PostTag)).describe("@relation"),
});

/**
 * Comment Model
 * Comments on posts
 */
export const Comment = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  /**
   * @db.Text
   */
  content: z.string(),

  /**
   * @default(now())
   */
  createdAt: z.date(),

  /**
   * @updatedAt
   */
  updatedAt: z.date(),

  // Author relation
  authorId: z.string(),
  author: z.lazy(() => User).describe("@relation(fields: [authorId], references: [id], onDelete: Cascade)"),

  // Post relation
  postId: z.string(),
  post: z.lazy(() => Post).describe("@relation(fields: [postId], references: [id], onDelete: Cascade)"),

  // Self-referential for nested comments
  parentId: z.string().nullable().optional(),
  parent: z.lazy(() => Comment).nullable().optional().describe('@relation("CommentReplies", fields: [parentId], references: [id])'),
  replies: z.array(z.lazy(() => Comment)).describe('@relation("CommentReplies")'),
});

/**
 * Like Model
 * Junction table for User-Post likes (many-to-many)
 */
export const Like = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  /**
   * @default(now())
   */
  createdAt: z.date(),

  // User relation
  userId: z.string(),
  user: z.lazy(() => User).describe("@relation(fields: [userId], references: [id], onDelete: Cascade)"),

  // Post relation
  postId: z.string(),
  post: z.lazy(() => Post).describe("@relation(fields: [postId], references: [id], onDelete: Cascade)"),
});

/**
 * Follow Model
 * Self-referential User follows (many-to-many)
 */
export const Follow = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  /**
   * @default(now())
   */
  createdAt: z.date(),

  // The user who is following
  followerId: z.string(),
  follower: z.lazy(() => User).describe('@relation("UserFollowing", fields: [followerId], references: [id], onDelete: Cascade)'),

  // The user being followed
  followingId: z.string(),
  following: z.lazy(() => User).describe('@relation("UserFollowers", fields: [followingId], references: [id], onDelete: Cascade)'),
});

/**
 * Tag Model
 * Hashtags for posts
 */
export const Tag = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  name: z.string().describe("@unique"),

  /**
   * @default(0)
   */
  usageCount: z.number().int(),

  posts: z.array(z.lazy(() => PostTag)).describe("@relation"),
});

/**
 * PostTag Model
 * Junction table for Post-Tag (many-to-many)
 */
export const PostTag = z.object({
  /**
   * @id
   * @default(cuid())
   */
  id: z.string().cuid(),

  postId: z.string(),
  post: z.lazy(() => Post).describe("@relation(fields: [postId], references: [id], onDelete: Cascade)"),

  tagId: z.string(),
  tag: z.lazy(() => Tag).describe("@relation(fields: [tagId], references: [id], onDelete: Cascade)"),

  /**
   * @default(now())
   */
  createdAt: z.date(),
});
