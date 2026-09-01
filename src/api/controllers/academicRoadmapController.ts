/**
 * Interactive Degree Roadmap Planner — API controller.
 *
 * Routes (all behind `authMiddleware`, registered in `server.ts`):
 *   GET  /api/planner/catalog   → full course catalog
 *   GET  /api/planner/roadmap   → the current user's saved roadmap (or a blank one)
 *   POST /api/planner/roadmap   → persist the user's roadmap (recomputes warnings)
 *   POST /api/planner/validate  → validate a single drag-and-drop placement
 *
 * Storage: one document per user in `academic_roadmaps` keyed by `userId`
 * (Firebase uid). The course catalog is seeded from `src/data/courseCatalog.ts`
 * into `course_catalog` on first read, so it also works against the MockDB.
 */

import { dbCommand, dbQuery } from "../db";
import { sendSuccess, sendError, sendBadRequest } from "../../lib/apiResponse";
import { z } from "zod";
import {
  getCourseCatalog as getCatalogData,
  DEFAULT_GRADUATION_REQUIREMENTS,
  CatalogCourse,
} from "../../data/courseCatalog";
import {
  validateRoadmap,
  validatePlacement,
  calculateGraduationProgress,
  PlannerSemester,
} from "../../utils/prerequisiteValidator";
import {
  SaveRoadmapRequestSchema,
  ValidatePlacementRequestSchema,
} from "../../models/academicRoadmapSchema";
import { CourseCatalogSchema as CourseSchema } from "../../models/courseCatalogSchema";

const CATALOG_COLLECTION = "course_catalog";
const ROADMAP_COLLECTION = "academic_roadmaps";

/**
 * `server.ts` owns the live Mongo connection (its own `db`), while the modular
 * `src/api/db.ts` pools (`dbCommand`/`dbQuery`) are only populated when that
 * layer is initialised. `configurePlannerDb` lets the host hand us its live
 * handle; we fall back to the modular pools, then to the static catalog.
 */
let dbGetter: (() => any) | null = null;
export function configurePlannerDb(getter: () => any) {
  dbGetter = getter;
}

const readDb = () => dbGetter?.() || dbQuery || dbCommand;
const writeDb = () => dbGetter?.() || dbCommand || dbQuery;

function uidOf(req: any): string | null {
  return req?.user?.uid || req?.user?.firebaseUid || req?.user?.user_id || null;
}

/**
 * Load the catalog, seeding the collection from the static dataset the first
 * time it is empty. Falls back to the static dataset on any DB error.
 */
async function loadCatalog(): Promise<CatalogCourse[]> {
  const seed = getCatalogData();
  const db = readDb();
  if (!db) return seed;

  try {
    const col = db.collection(CATALOG_COLLECTION);
    const existing = await col.find({}).toArray();
    if (existing && existing.length > 0) {
      return existing
        .map((doc: any) => {
          const parsed = CourseSchema.safeParse(doc);
          return parsed.success ? parsed.data : null;
        })
        .filter(Boolean) as CatalogCourse[];
    }
    // Seed once.
    const wdb = writeDb();
    if (wdb) {
      const col2 = wdb.collection(CATALOG_COLLECTION);
      for (const course of seed) {
        try {
          await col2.updateOne({ id: course.id }, { $set: course }, { upsert: true });
        } catch {
          /* best-effort seed */
        }
      }
    }
    return seed;
  } catch {
    return seed;
  }
}

function blankRoadmap(userId: string) {
  return {
    userId,
    degreeProgram: "B.S. Computer Science",
    startSemester: "Fall 2026",
    semesters: [] as PlannerSemester[],
    completedCourses: [] as string[],
    totalCreditsPlanned: 0,
    graduationRequirements: { ...DEFAULT_GRADUATION_REQUIREMENTS },
    warnings: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────

export async function getCourseCatalog(req: any, res: any) {
  try {
    const courses = await loadCatalog();
    return sendSuccess(res, {
      data: { courses, graduationRequirements: DEFAULT_GRADUATION_REQUIREMENTS },
    });
  } catch (err) {
    console.error("[Planner] getCatalog failed:", err);
    return sendError(res, "Failed to load course catalog");
  }
}

export async function getUserRoadmap(req: any, res: any) {
  const userId = uidOf(req);
  if (!userId) return sendError(res, "Unauthorized", 401);

  try {
    const db = readDb();
    let doc: any = null;
    if (db) {
      doc = await db.collection(ROADMAP_COLLECTION).findOne({ userId });
    }
    const roadmap = doc ? { ...blankRoadmap(userId), ...doc } : blankRoadmap(userId);

    const courses = await loadCatalog();
    const progress = calculateGraduationProgress({
      semesters: roadmap.semesters,
      courses,
      completedCourses: roadmap.completedCourses,
      requirements: roadmap.graduationRequirements,
    });
    // Keep warnings fresh even if the catalog changed since last save.
    roadmap.warnings = validateRoadmap(
      roadmap.semesters,
      courses,
      roadmap.completedCourses,
    );

    return sendSuccess(res, { data: { roadmap, progress } });
  } catch (err) {
    console.error("[Planner] getRoadmap failed:", err);
    return sendError(res, "Failed to load roadmap");
  }
}

export async function saveUserRoadmap(req: any, res: any) {
  const userId = uidOf(req);
  if (!userId) return sendError(res, "Unauthorized", 401);

  let body;
  try {
    body = SaveRoadmapRequestSchema.parse(req.body ?? {});
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, error: "Validation failed", details: err.issues });
    }
    return sendBadRequest(res, "Invalid roadmap payload");
  }

  try {
    const courses = await loadCatalog();
    const db = writeDb();

    const existing = db
      ? await db.collection(ROADMAP_COLLECTION).findOne({ userId })
      : null;
    const base = existing
      ? { ...blankRoadmap(userId), ...existing }
      : blankRoadmap(userId);

    const completedCourses = body.completedCourses ?? base.completedCourses ?? [];
    const graduationRequirements = {
      ...DEFAULT_GRADUATION_REQUIREMENTS,
      ...base.graduationRequirements,
      ...(body.graduationRequirements ?? {}),
    };

    const warnings = validateRoadmap(body.semesters, courses, completedCourses);
    const progress = calculateGraduationProgress({
      semesters: body.semesters,
      courses,
      completedCourses,
      requirements: graduationRequirements,
    });

    const roadmap = {
      userId,
      degreeProgram: body.degreeProgram ?? base.degreeProgram,
      startSemester: body.startSemester ?? base.startSemester,
      semesters: body.semesters,
      completedCourses,
      graduationRequirements,
      totalCreditsPlanned: progress.totalCreditsPlanned,
      warnings,
      createdAt: base.createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    if (db) {
      await db
        .collection(ROADMAP_COLLECTION)
        .updateOne({ userId }, { $set: roadmap }, { upsert: true });
    }

    return sendSuccess(res, { data: { roadmap, progress } });
  } catch (err) {
    console.error("[Planner] saveRoadmap failed:", err);
    return sendError(res, "Failed to save roadmap");
  }
}

export async function validatePlacementHandler(req: any, res: any) {
  const userId = uidOf(req);
  if (!userId) return sendError(res, "Unauthorized", 401);

  let body;
  try {
    body = ValidatePlacementRequestSchema.parse(req.body ?? {});
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, error: "Validation failed", details: err.issues });
    }
    return sendBadRequest(res, "Invalid validation payload");
  }

  try {
    const courses = await loadCatalog();
    const result = validatePlacement({
      courseId: body.courseId,
      targetSemesterId: body.targetSemesterId,
      semesters: body.semesters,
      courses,
      completedCourses: body.completedCourses ?? [],
    });
    return sendSuccess(res, { data: result });
  } catch (err) {
    console.error("[Planner] validatePlacement failed:", err);
    return sendError(res, "Failed to validate placement");
  }
}
