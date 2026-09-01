import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import { AlertTriangle } from "lucide-react";
import { CourseCard, PlannerCourse } from "./CourseCard";

const MAX_RECOMMENDED_SEMESTER_CREDITS = 18;

interface SemesterBoardProps {
  semester: {
    id: string;
    term: string;
    year: number;
    courseIds: string[];
  };
  courses: PlannerCourse[];
  completedIds?: string[];
  unmetCourseIds?: string[];
  onToggleComplete?: (courseId: string) => void;
  codeLookup?: Record<string, string>;
}

export const SemesterBoard: React.FC<SemesterBoardProps> = ({
  semester,
  courses,
  completedIds = [],
  unmetCourseIds = [],
  onToggleComplete,
  codeLookup,
}) => {
  const semesterCourses = semester.courseIds
    .map((id) => courses.find((c) => c.id === id))
    .filter(Boolean) as PlannerCourse[];

  const totalCredits = semesterCourses.reduce((sum, c) => sum + (c?.credits || 0), 0);
  const overloaded = totalCredits > MAX_RECOMMENDED_SEMESTER_CREDITS;
  const completedSet = new Set(completedIds);
  const unmetSet = new Set(unmetCourseIds);

  return (
    <div className="flex flex-col bg-slate-900/40 rounded-2xl border border-white/5 overflow-hidden w-80 flex-shrink-0">
      <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
        <h3 className="font-semibold text-slate-200">
          {semester.term} {semester.year}
        </h3>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${
            overloaded
              ? "bg-amber-500/15 text-amber-400"
              : "bg-blue-500/10 text-blue-400"
          }`}
        >
          {overloaded && <AlertTriangle className="w-3 h-3" />}
          {totalCredits} Credits
        </span>
      </div>

      {overloaded && (
        <div className="px-4 py-2 text-[11px] text-amber-400/90 bg-amber-500/5 border-b border-amber-500/10">
          Over the recommended {MAX_RECOMMENDED_SEMESTER_CREDITS}-credit load.
        </div>
      )}

      <Droppable droppableId={semester.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-4 flex flex-col gap-3 min-h-[150px] transition-colors ${
              snapshot.isDraggingOver ? "bg-white/5" : ""
            }`}
          >
            {semesterCourses.map((course, index) => (
              <CourseCard
                key={course.id}
                course={course}
                index={index}
                isCompleted={completedSet.has(course.id)}
                hasUnmetPrereqs={unmetSet.has(course.id)}
                onToggleComplete={onToggleComplete}
                codeLookup={codeLookup}
              />
            ))}
            {provided.placeholder}
            {semesterCourses.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-500 border-2 border-dashed border-white/5 rounded-xl min-h-[90px]">
                Drag courses here
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default SemesterBoard;
