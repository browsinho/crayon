import { z } from "zod";

/**
 * Open Graph metadata extracted from <meta property="og:*"> tags
 */
export const OpenGraphSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
  siteName: z.string().optional(),
});
export type OpenGraph = z.infer<typeof OpenGraphSchema>;

/**
 * Twitter Card metadata extracted from <meta name="twitter:*"> tags
 */
export const TwitterCardSchema = z.object({
  card: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  site: z.string().optional(),
  creator: z.string().optional(),
});
export type TwitterCard = z.infer<typeof TwitterCardSchema>;

/**
 * Heading structure extracted from the page
 */
export const HeadingSchema = z.object({
  level: z.number().min(1).max(6),
  text: z.string(),
});
export type Heading = z.infer<typeof HeadingSchema>;

/**
 * Navigation link extracted from nav elements
 */
export const NavLinkSchema = z.object({
  text: z.string(),
  href: z.string(),
});
export type NavLink = z.infer<typeof NavLinkSchema>;

/**
 * Comprehensive page metadata extracted via CDP
 * This gives the AI context about what the page is about
 */
export const PageMetadataSchema = z.object({
  // Basic metadata
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  author: z.string().optional(),
  language: z.string().optional(),
  charset: z.string().optional(),

  // Canonical and alternate URLs
  canonicalUrl: z.string().optional(),

  // Open Graph (Facebook, LinkedIn, etc.)
  openGraph: OpenGraphSchema.optional(),

  // Twitter Card
  twitterCard: TwitterCardSchema.optional(),

  // Favicon
  favicon: z.string().optional(),

  // Document structure
  headings: z.array(HeadingSchema).optional(),

  // Navigation structure
  navLinks: z.array(NavLinkSchema).optional(),

  // Main content summary (first ~500 chars of main/article content)
  mainContentPreview: z.string().optional(),

  // Detected forms and their purposes
  forms: z.array(z.object({
    action: z.string().optional(),
    method: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    inputCount: z.number(),
    hasPasswordField: z.boolean(),
    hasEmailField: z.boolean(),
  })).optional(),

  // Link counts
  internalLinkCount: z.number().optional(),
  externalLinkCount: z.number().optional(),

  // Semantic regions detected
  hasHeader: z.boolean().optional(),
  hasFooter: z.boolean().optional(),
  hasNav: z.boolean().optional(),
  hasMain: z.boolean().optional(),
  hasAside: z.boolean().optional(),
});
export type PageMetadata = z.infer<typeof PageMetadataSchema>;
