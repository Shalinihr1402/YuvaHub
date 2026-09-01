/**
 * Pure, framework-free prerequisite & graduation-progress logic for the
 * Interactive Degree Roadmap Planner.
 *
 * Everything here is deterministic and side-effect free so it can run on the
 * server (placement validation, roadmap persistence) and in the browser
 * (instant drag-and-drop feedback) from the same source of truth.
 */

import {
  CatalogCourse,
  GraduationRequirements,
  DEFAULT_GRADUATION_REQUIREMENTS,
  MAX_RECOMMENDED_SEMESTER_CREDITS,
  RequirementArea,
} from "../data/courseCatalog";

export interface PlannerSemester {
  id: string;
  term: string;
  year: number;
  courseIds: string[];
}

export type WarningType =
  | "prerequisite_missing"
  | "prerequisite_not_earlier"
  | "corequisite_missing"
  | "term_not_offered"
  | "credit_overload"
  | "duplicate_course";

export interface RoadmapWarning {
  courseId: string;
  semesterId: string;
  warningType: WarningType;
  message: string;
}

export interface PlacementResult {
  valid: boolean;
  warnings: RoadmapWarning[];
  /** Semester ids where the course could legally be placed instead. */
  suggestions: string[];
}

export interface RequirementProgress {
  area: RequirementArea | "total";
  earnedCredits: number;
  plannedCredits: number;
  requiredCredits: number;
  percentComplete: number;
}

export interface GraduationProgress {
  totalCreditsPlanned: number;
  totalCreditsEarned: number;
  totalCreditsRequired: number;
  percentComplete: number;
  semestersUsed: number;
  semestersRemaining: number;
  onTrack: boolean;
  breakdown: RequirementProgress[];
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

export function buildCourseMap(
  courses: CatalogCourse[],
): Map<string, CatalogCourse> {
  const map = new Map<string, CatalogCourse>();
  for (const course of courses) map.set(course.id, course);
  return map;
}

/**
 * Order the semesters chronologically and return a lookup from semester id to
 * its position (0 = earliest). Unknown ids map to `Infinity`.
 */
export function buildSemesterOrder(
  semesters: PlannerSemester[],
): Map<string, number> {
  const termRank: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
  const ordered = [...semesters].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return (termRank[a.term] ?? 0) - (termRank[b.term] ?? 0);
  });
  const order = new Map<string, number>();
  ordered.forEach((s, idx) => order.set(s.id, idx));
  return order;
}

/** Course ids scheduled strictly before `semesterId`. */
function courseIdsBefore(
  semesterId: string,
  semesters: PlannerSemester[],
  order: Map<string, number>,
): Set<string> {
  const target = order.get(semesterId) ?? Infinity;
  const ids = new Set<string>();
  for (const sem of semesters) {
    if ((order.get(sem.id) ?? Infinity) < target) {
      for (const id of sem.courseIds) ids.add(id);
    }
  }
  return ids;
}

/** Course ids scheduled in the same semester as `semesterId` (excluding `exclude`). */
function courseIdsSameSemester(
  semesterId: string,
  semesters: PlannerSemester[],
  exclude?: string,
): Set<string> {
  const ids = new Set<string>();
  const sem = semesters.find((s) => s.id === semesterId);
  if (!sem) return ids;
  for (const id of sem.courseIds) if (id !== exclude) ids.add(id);
  return ids;
}

// ─────────────────────────────────────────────────────────────────────
// Prerequisite checks
// ─────────────────────────────────────────────────────────────────────

export interface PrereqCheck {
  met: boolean;
  missing: string[];
}

/**
 * Are all prerequisites of `courseId` satisfied by `earnedOrEarlier`?
 * `earnedOrEarlier` should contain completed courses plus anything scheduled
 * before the semester in question.
 */
export function checkPrerequisitesMet(
  courseId: string,
  earnedOrEarlier: Set<string> | string[],
  courseMap: Map<string, CatalogCourse>,
): PrereqCheck {
  const have = earnedOrEarlier instanceof Set
    ? earnedOrEarlier
    : new Set(earnedOrEarlier);
  const course = courseMap.get(courseId);
  if (!course) return { met: true, missing: [] };
  const missing = course.prerequisites.filter((p) => !have.has(p));
  return { met: missing.length === 0, missing };
}

// ─────────────────────────────────────────────────────────────────────
// Placement validation (single drag-and-drop move)
// ─────────────────────────────────────────────────────────────────────

export interface ValidatePlacementInput {
  courseId: string;
  targetSemesterId: string;
  semesters: PlannerSemester[];
  courses: CatalogCourse[];
  completedCourses?: string[];
}

export function validatePlacement(
  input: ValidatePlacementInput,
): PlacementResult {
  const {
    courseId,
    targetSemesterId,
    semesters,
    courses,
    completedCourses = [],
  } = input;

  const courseMap = buildCourseMap(courses);
  const order = buildSemesterOrder(semesters);
  const course = courseMap.get(courseId);
  const warnings: RoadmapWarning[] = [];

  if (!course) return { valid: true, warnings, suggestions: [] };

  const targetSem = semesters.find((s) => s.id === targetSemesterId);

  // Prerequisites: must be completed or scheduled in an earlier semester.
  const priorIds = courseIdsBefore(targetSemesterId, semesters, order);
  for (const id of completedCourses) priorIds.add(id);

  for (const prereq of course.prerequisites) {
    if (priorIds.has(prereq)) continue;
    const scheduledLater = semesters.some(
      (s) =>
        s.courseIds.includes(prereq) &&
        (order.get(s.id) ?? Infinity) >= (order.get(targetSemesterId) ?? Infinity),
    );
    warnings.push({
      courseId,
      semesterId: targetSemesterId,
      warningType: scheduledLater
        ? "prerequisite_not_earlier"
        : "prerequisite_missing",
      message: scheduledLater
        ? `${course.code} needs ${labelFor(prereq, courseMap)} completed in an earlier semester.`
        : `${course.code} requires ${labelFor(prereq, courseMap)} first.`,
    });
  }

  // Corequisites: same semester or earlier.
  const sameSem = courseIdsSameSemester(targetSemesterId, semesters, courseId);
  for (const coreq of course.corequisites) {
    if (priorIds.has(coreq) || sameSem.has(coreq)) continue;
    warnings.push({
      courseId,
      semesterId: targetSemesterId,
      warningType: "corequisite_missing",
      message: `${course.code} should be taken with or after ${labelFor(coreq, courseMap)}.`,
    });
  }

  // Term availability.
  if (targetSem && !course.termsOffered.includes(targetSem.term as any)) {
    warnings.push({
      courseId,
      semesterId: targetSemesterId,
      warningType: "term_not_offered",
      message: `${course.code} is only offered in ${course.termsOffered.join(", ")}.`,
    });
  }

  const blocking = warnings.filter(
    (w) =>
      w.warningType === "prerequisite_missing" ||
      w.warningType === "prerequisite_not_earlier",
  );

  return {
    valid: blocking.length === 0,
    warnings,
    suggestions: blocking.length
      ? suggestAlternativeSemesters(courseId, semesters, courses, completedCourses)
      : [],
  };
}

/**
 * Earliest semesters (chronologically) where `courseId` would satisfy all
 * prerequisites. Returns up to three semester ids.
 */
export function suggestAlternativeSemesters(
  courseId: string,
  semesters: PlannerSemester[],
  courses: CatalogCourse[],
  completedCourses: string[] = [],
): string[] {
  const courseMap = buildCourseMap(courses);
  const order = buildSemesterOrder(semesters);
  const course = courseMap.get(courseId);
  if (!course) return [];

  const ordered = [...semesters].sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );

  const out: string[] = [];
  for (const sem of ordered) {
    const prior = courseIdsBefore(sem.id, semesters, order);
    for (const id of completedCourses) prior.add(id);
    const { met } = checkPrerequisitesMet(courseId, prior, courseMap);
    const termOk =
      course.termsOffered.length === 0 ||
      course.termsOffered.includes(sem.term as any);
    if (met && termOk) {
      out.push(sem.id);
      if (out.length === 3) break;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Whole-roadmap validation
// ─────────────────────────────────────────────────────────────────────

export function validateRoadmap(
  semesters: PlannerSemester[],
  courses: CatalogCourse[],
  completedCourses: string[] = [],
): RoadmapWarning[] {
  const courseMap = buildCourseMap(courses);
  const order = buildSemesterOrder(semesters);
  const warnings: RoadmapWarning[] = [];
  const seen = new Set<string>();

  for (const sem of semesters) {
    let semCredits = 0;

    for (const courseId of sem.courseIds) {
      const course = courseMap.get(courseId);
      if (!course) continue;
      semCredits += course.credits;

      if (seen.has(courseId)) {
        warnings.push({
          courseId,
          semesterId: sem.id,
          warningType: "duplicate_course",
          message: `${course.code} is planned more than once.`,
        });
      }
      seen.add(courseId);

      const prior = courseIdsBefore(sem.id, semesters, order);
      for (const id of completedCourses) prior.add(id);
      const { missing } = checkPrerequisitesMet(courseId, prior, courseMap);
      for (const m of missing) {
        const scheduledLater = semesters.some(
          (s) =>
            s.courseIds.includes(m) &&
            (order.get(s.id) ?? Infinity) >= (order.get(sem.id) ?? Infinity),
        );
        warnings.push({
          courseId,
          semesterId: sem.id,
          warningType: scheduledLater
            ? "prerequisite_not_earlier"
            : "prerequisite_missing",
          message: scheduledLater
            ? `${course.code} needs ${labelFor(m, courseMap)} in an earlier semester.`
            : `${course.code} requires ${labelFor(m, courseMap)} first.`,
        });
      }

      const sameSem = courseIdsSameSemester(sem.id, semesters, courseId);
      for (const coreq of course.corequisites) {
        if (prior.has(coreq) || sameSem.has(coreq)) continue;
        warnings.push({
          courseId,
          semesterId: sem.id,
          warningType: "corequisite_missing",
          message: `${course.code} should be taken with ${labelFor(coreq, courseMap)}.`,
        });
      }

      if (
        course.termsOffered.length > 0 &&
        !course.termsOffered.includes(sem.term as any)
      ) {
        warnings.push({
          courseId,
          semesterId: sem.id,
          warningType: "term_not_offered",
          message: `${course.code} is only offered in ${course.termsOffered.join(", ")}.`,
        });
      }
    }

    if (semCredits > MAX_RECOMMENDED_SEMESTER_CREDITS) {
      warnings.push({
        courseId: "",
        semesterId: sem.id,
        warningType: "credit_overload",
        message: `${sem.term} ${sem.year} has ${semCredits} credits (over the recommended ${MAX_RECOMMENDED_SEMESTER_CREDITS}).`,
      });
    }
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────
// Graduation progress
// ─────────────────────────────────────────────────────────────────────

export interface GraduationProgressInput {
  semesters: PlannerSemester[];
  courses: CatalogCourse[];
  completedCourses?: string[];
  requirements?: GraduationRequirements;
}

export function calculateGraduationProgress(
  input: GraduationProgressInput,
): GraduationProgress {
  const {
    semesters,
    courses,
    completedCourses = [],
    requirements = DEFAULT_GRADUATION_REQUIREMENTS,
  } = input;

  const courseMap = buildCourseMap(courses);
  const completedSet = new Set(completedCourses);

  const areas: RequirementArea[] = ["core", "elective", "genEd"];
  const earned: Record<string, number> = { core: 0, elective: 0, genEd: 0, total: 0 };
  const planned: Record<string, number> = { core: 0, elective: 0, genEd: 0, total: 0 };

  const countedPlanned = new Set<string>();
  for (const sem of semesters) {
    for (const id of sem.courseIds) {
      const course = courseMap.get(id);
      if (!course || countedPlanned.has(id)) continue;
      countedPlanned.add(id);
      planned[course.requirementArea] += course.credits;
      planned.total += course.credits;
    }
  }
  for (const id of completedSet) {
    const course = courseMap.get(id);
    if (!course) continue;
    earned[course.requirementArea] += course.credits;
    earned.total += course.credits;
  }

  const required: Record<string, number> = {
    core: requirements.coreCreditsRequired,
    elective: requirements.electiveCreditsRequired,
    genEd: requirements.genEdCreditsRequired,
    total: requirements.totalCreditsRequired,
  };

  const breakdown: RequirementProgress[] = [...areas, "total" as const].map(
    (area) => {
      const req = required[area] || 0;
      const plan = planned[area] || 0;
      return {
        area,
        earnedCredits: earned[area] || 0,
        plannedCredits: plan,
        requiredCredits: req,
        percentComplete: req > 0 ? Math.min(100, Math.round((plan / req) * 100)) : 0,
      };
    },
  );

  const semestersUsed = semesters.filter((s) => s.courseIds.length > 0).length;
  const percentComplete =
    requirements.totalCreditsRequired > 0
      ? Math.min(
          100,
          Math.round((planned.total / requirements.totalCreditsRequired) * 100),
        )
      : 0;

  return {
    totalCreditsPlanned: planned.total,
    totalCreditsEarned: earned.total,
    totalCreditsRequired: requirements.totalCreditsRequired,
    percentComplete,
    semestersUsed,
    semestersRemaining: Math.max(0, semesters.length - semestersUsed),
    onTrack: planned.total >= requirements.totalCreditsRequired,
    breakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────

function labelFor(id: string, courseMap: Map<string, CatalogCourse>): string {
  return courseMap.get(id)?.code ?? id;
}
