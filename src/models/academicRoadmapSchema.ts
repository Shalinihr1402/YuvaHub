import { z } from "zod";

/**
 * Persistence + request schemas for the Interactive Degree Roadmap Planner.
 * Stored in the `academic_roadmaps` collection, one document per user
 * (`userId` = Firebase uid).
 */

export const SemesterSchema = z.object({
  id: z.string(), // e.g., "sem-0"
  term: z.enum(["Fall", "Spring", "Summer"]),
  year: z.number().int(),
  courseIds: z.array(z.string()).default([]),
});

export const RoadmapWarningSchema = z.object({
  courseId: z.string(),
  semesterId: z.string(),
  warningType: z.enum([
    "prerequisite_missing",
    "prerequisite_not_earlier",
    "corequisite_missing",
    "term_not_offered",
    "credit_overload",
    "duplicate_course",
  ]),
  message: z.string(),
});

export const GraduationRequirementsSchema = z.object({
  totalCreditsRequired: z.number().int().default(120),
  coreCreditsRequired: z.number().int().default(45),
  electiveCreditsRequired: z.number().int().default(30),
  genEdCreditsRequired: z.number().int().default(18),
});

export const AcademicRoadmapSchema = z.object({
  userId: z.string(),
  degreeProgram: z.string().default("B.S. Computer Science"),
  startSemester: z.string().default("Fall 2026"),
  semesters: z.array(SemesterSchema).default([]),
  completedCourses: z.array(z.string()).default([]),
  totalCreditsPlanned: z.number().int().default(0),
  graduationRequirements: GraduationRequirementsSchema.default({
    totalCreditsRequired: 120,
    coreCreditsRequired: 45,
    electiveCreditsRequired: 30,
    genEdCreditsRequired: 18,
  }),
  warnings: z.array(RoadmapWarningSchema).default([]),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

/** Body accepted by `POST /api/planner/roadmap`. */
export const SaveRoadmapRequestSchema = z.object({
  semesters: z.array(SemesterSchema).default([]),
  completedCourses: z.array(z.string()).optional(),
  degreeProgram: z.string().optional(),
  startSemester: z.string().optional(),
  graduationRequirements: GraduationRequirementsSchema.partial().optional(),
});

/** Body accepted by `POST /api/planner/validate`. */
export const ValidatePlacementRequestSchema = z.object({
  courseId: z.string(),
  targetSemesterId: z.string(),
  semesters: z.array(SemesterSchema),
  completedCourses: z.array(z.string()).optional(),
});

export type Semester = z.infer<typeof SemesterSchema>;
export type AcademicRoadmap = z.infer<typeof AcademicRoadmapSchema>;
export type SaveRoadmapRequest = z.infer<typeof SaveRoadmapRequestSchema>;
export type ValidatePlacementRequest = z.infer<typeof ValidatePlacementRequestSchema>;
