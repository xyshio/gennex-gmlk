import { z } from "zod";

/**
 * Input schemas for API routes. The on-disk shape adds `id`,
 * `createdAt`, `updatedAt` server-side, so request bodies don't carry
 * them. `photos` defaults to [] so clients don't need to ship it on
 * "create" calls.
 */

export const PersonInputSchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  maidenName: z.string().max(120).optional().or(z.literal("")).transform((v) =>
    v ? v : undefined,
  ),
  sex: z.enum(["M", "F", "U"]).optional(),
  // Dates are loose strings — partial dates are valid (eg "1950" or
  // "1950-03"). Validation is "looks like a date" not "is a real date".
  birthDate: z
    .string()
    .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  birthPlace: z.string().max(200).optional().or(z.literal("")).transform((v) =>
    v ? v : undefined,
  ),
  deathDate: z
    .string()
    .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  deathPlace: z.string().max(200).optional().or(z.literal("")).transform((v) =>
    v ? v : undefined,
  ),
  notes: z.string().max(10000).optional().or(z.literal("")).transform((v) =>
    v ? v : undefined,
  ),
  photos: z.array(z.string()).optional().default([]),
});
export type PersonInput = z.infer<typeof PersonInputSchema>;

export const ParentChildInputSchema = z.object({
  type: z.literal("parent-child"),
  parent: z.string().min(1),
  child: z.string().min(1),
  adoptive: z.boolean().optional(),
});

export const MarriageInputSchema = z.object({
  type: z.literal("marriage"),
  personA: z.string().min(1),
  personB: z.string().min(1),
  from: z
    .string()
    .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
    .optional(),
  divorced: z.boolean().optional(),
});

export const PartnershipInputSchema = z.object({
  type: z.literal("partnership"),
  personA: z.string().min(1),
  personB: z.string().min(1),
  from: z
    .string()
    .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
    .optional(),
});

export const RelationshipInputSchema = z.discriminatedUnion("type", [
  ParentChildInputSchema,
  MarriageInputSchema,
  PartnershipInputSchema,
]);
export type RelationshipInput = z.infer<typeof RelationshipInputSchema>;
