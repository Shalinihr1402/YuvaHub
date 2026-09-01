import { describe, it, expect } from "vitest";
import {
  validatePlacement,
  validateRoadmap,
  calculateGraduationProgress,
  checkPrerequisitesMet,
  buildCourseMap,
  suggestAlternativeSemesters,
  PlannerSemester,
} from "../src/utils/prerequisiteValidator.js";
import { COURSE_CATALOG } from "../src/data/courseCatalog.js";

const courses = COURSE_CATALOG;

const semesters = (assign: Record<string, string[]>): PlannerSemester[] =>
  Array.from({ length: 8 }).map((_, i) => {
    const term = i % 2 === 0 ? "Fall" : "Spring";
    const year =
      term === "Fall" ? 2026 + Math.floor(i / 2) : 2026 + Math.floor(i / 2) + 1;
    return {
      id: `sem-${i}`,
      term,
      year,
      courseIds: assign[`sem-${i}`] ?? [],
    };
  });

describe("prerequisiteValidator", () => {
  it("checkPrerequisitesMet reports missing prerequisites", () => {
    const map = buildCourseMap(courses);
    const r = checkPrerequisitesMet("CS201", ["CS102"], map);
    expect(r.met).toBe(false);
    expect(r.missing).toContain("CS220");
  });

  it("blocks a placement whose prerequisites are not in an earlier semester", () => {
    const plan = semesters({ "sem-0": ["CS102"] }); // CS201 needs CS102 + CS220
    const result = validatePlacement({
      courseId: "CS201",
      targetSemesterId: "sem-0",
      semesters: plan,
      courses,
    });
    expect(result.valid).toBe(false);
    expect(result.warnings.some((w) => w.warningType.startsWith("prerequisite"))).toBe(true);
  });

  it("allows a placement once prerequisites sit in earlier semesters", () => {
    const plan = semesters({
      "sem-0": ["CS101", "MATH101"],
      "sem-1": ["CS102", "CS220"],
      "sem-2": ["CS201"],
    });
    const result = validatePlacement({
      courseId: "CS201",
      targetSemesterId: "sem-2",
      semesters: plan,
      courses,
    });
    expect(result.valid).toBe(true);
  });

  it("counts completed courses as satisfying prerequisites", () => {
    const plan = semesters({ "sem-0": ["CS102"] });
    const result = validatePlacement({
      courseId: "CS210",
      targetSemesterId: "sem-0",
      semesters: plan,
      courses,
      completedCourses: ["CS101"],
    });
    // CS210 requires CS102 which is in the same semester, not earlier -> still blocked
    expect(result.valid).toBe(false);
    const ok = validatePlacement({
      courseId: "CS210",
      targetSemesterId: "sem-1",
      semesters: semesters({ "sem-0": ["CS102"] }),
      courses,
      completedCourses: ["CS101"],
    });
    expect(ok.valid).toBe(true);
  });

  it("suggests alternative semesters for a blocked course", () => {
    const plan = semesters({
      "sem-0": ["CS101", "MATH101"],
      "sem-1": ["CS102", "CS220"],
    });
    const suggestions = suggestAlternativeSemesters("CS201", plan, courses);
    expect(suggestions).toContain("sem-2");
  });

  it("flags credit overload for a heavy semester", () => {
    const plan = semesters({ "sem-0": ["CS102", "MATH101", "MATH201", "PHYS101", "PHYS102"] });
    const warnings = validateRoadmap(plan, courses);
    expect(warnings.some((w) => w.warningType === "credit_overload")).toBe(true);
  });

  it("flags a course scheduled in a term it is not offered", () => {
    // CS 340 is Fall-only; sem-1 is Spring.
    const plan = semesters({
      "sem-0": ["CS101", "MATH101", "CS102", "CS220", "CS201"],
      "sem-1": ["CS340"],
    });
    const warnings = validateRoadmap(plan, courses);
    expect(warnings.some((w) => w.warningType === "term_not_offered" && w.courseId === "CS340")).toBe(true);
  });

  it("computes graduation progress with a requirement-area breakdown", () => {
    const plan = semesters({
      "sem-0": ["CS101", "MATH101", "ENG101"],
      "sem-1": ["CS102", "CS220"],
    });
    const progress = calculateGraduationProgress({ semesters: plan, courses });
    expect(progress.totalCreditsPlanned).toBe(3 + 4 + 3 + 4 + 3);
    expect(progress.breakdown.find((b) => b.area === "genEd")?.plannedCredits).toBe(3);
    expect(progress.breakdown.find((b) => b.area === "core")?.plannedCredits).toBe(3 + 4 + 3);
    expect(progress.onTrack).toBe(false);
  });
});
