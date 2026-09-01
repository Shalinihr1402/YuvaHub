import { z } from "zod";

/**
 * Shape of a catalog course as served by `GET /api/planner/catalog`.
 * The canonical dataset lives in `src/data/courseCatalog.ts`; this schema is
 * used to validate anything read back from / written to the
 * `course_catalog` collection.
 */

export const CourseCatalogSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  department: z.string().default("General"),
  credits: z.number().int().min(1),
  description: z.string().default(""),
  prerequisites: z.array(z.string()).default([]), // array of course IDs
  corequisites: z.array(z.string()).default([]),
  termsOffered: z
    .array(z.enum(["Fall", "Spring", "Summer"]))
    .default(["Fall", "Spring"]),
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .default("intermediate"),
  requirementArea: z.enum(["core", "elective", "genEd"]).default("elective"),
});

export type CourseCatalog = z.infer<typeof CourseCatalogSchema>;
