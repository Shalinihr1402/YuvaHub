import React, { useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { GraduationCap, BookOpen, AlertCircle, Save, Download, Search, ListChecks } from "lucide-react";
import { SemesterBoard } from "../components/planner/SemesterBoard";
import { CourseCard, PlannerCourse } from "../components/planner/CourseCard";
import { PrerequisiteAlert } from "../components/planner/PrerequisiteAlert";
import { ProgressTracker } from "../components/planner/ProgressTracker";
import { apiFetch } from "../lib/apiFetch";
import {
  validateRoadmap,
  calculateGraduationProgress,
  RoadmapWarning,
} from "../utils/prerequisiteValidator";
import { DEFAULT_GRADUATION_REQUIREMENTS } from "../data/courseCatalog";

interface Semester {
  id: string;
  term: string;
  year: number;
  courseIds: string[];
}

const UNASSIGNED = "unassigned";

const START_YEAR = 2026;

function makeDefaultSemesters(): Semester[] {
  // Fall of year N is followed by Spring of year N+1, so the ids stay in
  // chronological order (sem-0 = first term, sem-7 = last).
  return Array.from({ length: 8 }).map((_, i) => {
    const term = i % 2 === 0 ? "Fall" : "Spring";
    const year =
      term === "Fall"
        ? START_YEAR + Math.floor(i / 2)
        : START_YEAR + Math.floor(i / 2) + 1;
    return {
      id: `sem-${i}`,
      term,
      year,
      courseIds: [],
    };
  });
}

export const DegreePlannerHub = () => {
  const [courses, setCourses] = useState<PlannerCourse[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [unassignedCourses, setUnassignedCourses] = useState<string[]>([]);
  const [completedCourses, setCompletedCourses] = useState<string[]>([]);
  const [requirements, setRequirements] = useState(DEFAULT_GRADUATION_REQUIREMENTS);
  const [alertMsg, setAlertMsg] = useState("");
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ── Load catalog + roadmap ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const [catalogRes, roadmapRes] = await Promise.all([
          apiFetch("/api/planner/catalog"),
          apiFetch("/api/planner/roadmap"),
        ]);
        if (cancelled) return;

        const catalog: PlannerCourse[] = catalogRes?.data?.courses ?? [];
        setCourses(catalog);
        if (catalogRes?.data?.graduationRequirements) {
          setRequirements(catalogRes.data.graduationRequirements);
        }

        const roadmap = roadmapRes?.data?.roadmap;
        const savedSemesters: Semester[] =
          roadmap?.semesters?.length > 0 ? roadmap.semesters : makeDefaultSemesters();
        setSemesters(savedSemesters);
        setCompletedCourses(roadmap?.completedCourses ?? []);
        if (roadmap?.graduationRequirements) {
          setRequirements(roadmap.graduationRequirements);
        }

        const assigned = new Set<string>(
          savedSemesters.flatMap((s: Semester) => s.courseIds),
        );
        setUnassignedCourses(
          catalog.map((c) => c.id).filter((id) => !assigned.has(id)),
        );
      } catch (err: any) {
        if (!cancelled) {
          console.error("Failed to load planner data", err);
          setLoadError(err?.message || "Could not load the degree planner.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Persistence ──────────────────────────────────────────────────
  const persist = async (
    nextSemesters: Semester[],
    nextCompleted: string[] = completedCourses,
  ) => {
    setIsSaving(true);
    try {
      await apiFetch("/api/planner/roadmap", {
        method: "POST",
        body: JSON.stringify({
          semesters: nextSemesters,
          completedCourses: nextCompleted,
        }),
      });
    } catch (err) {
      console.error("Failed to save roadmap", err);
      setAlertMsg("Could not save your changes. Check your connection and retry.");
      setTimeout(() => setAlertMsg(""), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Derived: validation warnings + progress (computed live) ───────
  const warnings: RoadmapWarning[] = useMemo(() => {
    if (courses.length === 0) return [];
    return validateRoadmap(semesters as any, courses as any, completedCourses);
  }, [semesters, courses, completedCourses]);

  const unmetCourseIds = useMemo(
    () =>
      warnings
        .filter(
          (w) =>
            w.warningType === "prerequisite_missing" ||
            w.warningType === "prerequisite_not_earlier",
        )
        .map((w) => w.courseId),
    [warnings],
  );

  const progress = useMemo(() => {
    if (courses.length === 0) return null;
    return calculateGraduationProgress({
      semesters: semesters as any,
      courses: courses as any,
      completedCourses,
      requirements,
    });
  }, [semesters, courses, completedCourses, requirements]);

  const codeLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of courses) map[c.id] = c.code;
    return map;
  }, [courses]);

  const courseById = useMemo(() => {
    const map: Record<string, PlannerCourse> = {};
    for (const c of courses) map[c.id] = c;
    return map;
  }, [courses]);

  const filteredUnassigned = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unassignedCourses;
    return unassignedCourses.filter((id) => {
      const c = courseById[id];
      if (!c) return false;
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [search, unassignedCourses, courseById]);

  // ── Drag handling ────────────────────────────────────────────────
  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Block placement when prerequisites are not satisfied by an earlier semester.
    const course = courseById[draggableId];
    const movingToSemester = destination.droppableId !== UNASSIGNED;
    if (course && course.prerequisites.length > 0 && movingToSemester) {
      const termRank: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };
      const ordered = [...semesters].sort((a, b) =>
        a.year !== b.year ? a.year - b.year : termRank[a.term] - termRank[b.term],
      );
      const orderIndex = new Map(ordered.map((s, i) => [s.id, i]));
      const destOrder = orderIndex.get(destination.droppableId) ?? Infinity;

      const earnedOrEarlier = new Set<string>(completedCourses);
      for (const s of semesters) {
        if ((orderIndex.get(s.id) ?? Infinity) < destOrder) {
          for (const cid of s.courseIds) {
            if (cid !== draggableId) earnedOrEarlier.add(cid);
          }
        }
      }

      const missing = course.prerequisites.filter((p) => !earnedOrEarlier.has(p));
      if (missing.length > 0) {
        const labels = missing.map((p) => codeLookup[p] ?? p).join(", ");
        setAlertMsg(
          `${course.code} needs ${labels} completed in an earlier semester.`,
        );
        setTimeout(() => setAlertMsg(""), 5000);
        return;
      }
    }

    const getList = (id: string) =>
      id === UNASSIGNED
        ? [...unassignedCourses]
        : [...(semesters.find((s) => s.id === id)?.courseIds || [])];

    const startList = getList(source.droppableId);
    const endList =
      source.droppableId === destination.droppableId
        ? startList
        : getList(destination.droppableId);

    startList.splice(source.index, 1);
    endList.splice(destination.index, 0, draggableId);

    let nextUnassigned = unassignedCourses;
    if (source.droppableId === UNASSIGNED || destination.droppableId === UNASSIGNED) {
      nextUnassigned = source.droppableId === destination.droppableId ? startList : (
        destination.droppableId === UNASSIGNED ? endList : startList
      );
      setUnassignedCourses(nextUnassigned);
    }

    const nextSemesters = semesters.map((s) => {
      if (s.id === source.droppableId && s.id === destination.droppableId) {
        return { ...s, courseIds: startList };
      }
      if (s.id === source.droppableId) return { ...s, courseIds: startList };
      if (s.id === destination.droppableId) return { ...s, courseIds: endList };
      return s;
    });
    setSemesters(nextSemesters);

    if (
      source.droppableId !== UNASSIGNED ||
      destination.droppableId !== UNASSIGNED
    ) {
      persist(nextSemesters);
    }
  };

  const toggleComplete = (courseId: string) => {
    const next = completedCourses.includes(courseId)
      ? completedCourses.filter((id) => id !== courseId)
      : [...completedCourses, courseId];
    setCompletedCourses(next);
    persist(semesters, next);
  };

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      degreeProgram: "B.S. Computer Science",
      graduationRequirements: requirements,
      completedCourses,
      semesters: semesters.map((s) => ({
        term: s.term,
        year: s.year,
        courses: s.courseIds.map((id) => {
          const c = courseById[id];
          return c ? { code: c.code, title: c.title, credits: c.credits } : { id };
        }),
      })),
      summary: progress,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "degree-roadmap.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPlannedCredits = progress?.totalCreditsPlanned ?? 0;
  const gradTotal = requirements.totalCreditsRequired;
  const pct = Math.min(
    100,
    Math.round((totalPlannedCredits / Math.max(1, gradTotal)) * 100),
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col">
      <PrerequisiteAlert message={alertMsg} onClose={() => setAlertMsg("")} />

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-400" />
            Degree Planner Hub
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Plan your academic journey and track prerequisites visually.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={exportJson}
            className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <div className="flex items-center gap-4 bg-slate-900 rounded-xl p-4 border border-white/5">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 uppercase tracking-wider">
                Progress
              </span>
              <span className="text-xl font-bold text-white">
                {totalPlannedCredits} / {gradTotal}{" "}
                <span className="text-sm font-normal text-slate-400">Credits</span>
              </span>
            </div>
            <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {isSaving ? (
              <span className="text-xs text-slate-400 flex items-center gap-1 animate-pulse">
                <Save className="w-3 h-3" /> Saving...
              </span>
            ) : (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
        </div>
      </header>

      {loadError && (
        <div className="m-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {loadError}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Sidebar - Course Catalog */}
          <div className="w-80 bg-slate-900/30 border-r border-white/5 flex flex-col">
            <div className="p-4 border-b border-white/5 bg-slate-900/50 flex flex-col gap-3">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                Course Catalog
                <span className="text-xs font-normal text-slate-500">
                  ({filteredUnassigned.length})
                </span>
              </h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, title, department"
                  className="w-full text-sm bg-slate-800/70 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/40"
                  aria-label="Search course catalog"
                />
              </div>
            </div>

            <Droppable droppableId={UNASSIGNED}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 overflow-y-auto p-4 flex flex-col gap-3 ${
                    snapshot.isDraggingOver ? "bg-white/5" : ""
                  }`}
                >
                  {isLoading && (
                    <div className="text-center text-sm text-slate-500 py-8 animate-pulse">
                      Loading catalog...
                    </div>
                  )}
                  {!isLoading &&
                    filteredUnassigned.map((id, index) => {
                      const course = courseById[id];
                      if (!course) return null;
                      return (
                        <CourseCard
                          key={course.id}
                          course={course}
                          index={index}
                          isCompleted={completedCourses.includes(course.id)}
                          codeLookup={codeLookup}
                        />
                      );
                    })}
                  {provided.placeholder}
                  {!isLoading &&
                    filteredUnassigned.length === 0 &&
                    !snapshot.isDraggingOver && (
                      <div className="text-center text-sm text-slate-500 py-8">
                        {search
                          ? "No courses match your search."
                          : "All available courses planned."}
                      </div>
                    )}
                </div>
              )}
            </Droppable>
          </div>

          {/* Main Board - Semesters */}
          <div className="flex-1 overflow-auto p-6 bg-slate-950">
            <div className="flex gap-6 pb-6">
              {semesters.map((semester) => (
                <SemesterBoard
                  key={semester.id}
                  semester={semester}
                  courses={courses}
                  completedIds={completedCourses}
                  unmetCourseIds={unmetCourseIds}
                  onToggleComplete={toggleComplete}
                  codeLookup={codeLookup}
                />
              ))}
            </div>

            {/* Progress + warnings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
              <ProgressTracker progress={progress} />

              <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5">
                <h3 className="font-semibold text-slate-100 flex items-center gap-2 mb-3">
                  <ListChecks className="w-4 h-4 text-amber-400" />
                  Plan Checks
                  <span className="text-xs font-normal text-slate-500">
                    ({warnings.length})
                  </span>
                </h3>
                {warnings.length === 0 ? (
                  <p className="text-sm text-emerald-400">
                    No prerequisite conflicts or overloads detected.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                    {warnings.map((w, i) => (
                      <li
                        key={`${w.courseId}-${w.semesterId}-${i}`}
                        className="text-xs text-slate-300 flex items-start gap-2"
                      >
                        <AlertCircle
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                            w.warningType === "credit_overload"
                              ? "text-amber-400"
                              : "text-rose-400"
                          }`}
                        />
                        <span>{w.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};

export default DegreePlannerHub;
