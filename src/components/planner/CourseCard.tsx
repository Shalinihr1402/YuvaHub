import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { BookOpen, CheckCircle2, Circle, Lock } from "lucide-react";

export interface PlannerCourse {
  id: string;
  code: string;
  title: string;
  credits: number;
  prerequisites: string[];
  department?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  requirementArea?: "core" | "elective" | "genEd";
  termsOffered?: string[];
}

interface CourseCardProps {
  course: PlannerCourse;
  index: number;
  /** Course is marked completed by the student. */
  isCompleted?: boolean;
  /** Prerequisites are not yet satisfied at this position. */
  hasUnmetPrereqs?: boolean;
  onToggleComplete?: (courseId: string) => void;
  codeLookup?: Record<string, string>;
}

const difficultyColor: Record<string, string> = {
  beginner: "text-emerald-400",
  intermediate: "text-amber-400",
  advanced: "text-rose-400",
};

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  index,
  isCompleted = false,
  hasUnmetPrereqs = false,
  onToggleComplete,
  codeLookup,
}) => {
  const prereqLabels = course.prerequisites.map((id) => codeLookup?.[id] ?? id);

  return (
    <Draggable draggableId={course.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-4 rounded-xl border transition-all duration-200 flex flex-col gap-2 ${
            snapshot.isDragging
              ? "bg-slate-800/80 border-blue-500/50 shadow-xl shadow-blue-500/10 scale-105 z-50"
              : isCompleted
                ? "bg-emerald-500/5 border-emerald-500/30"
                : hasUnmetPrereqs
                  ? "bg-rose-500/5 border-rose-500/30"
                  : "bg-slate-900/50 border-white/5 hover:border-white/10 hover:bg-slate-800/50"
          }`}
          style={{ ...provided.draggableProps.style }}
        >
          <div className="flex justify-between items-start gap-2">
            <span className="font-semibold text-blue-400">{course.code}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasUnmetPrereqs && !isCompleted && (
                <Lock className="w-3.5 h-3.5 text-rose-400" aria-label="Prerequisites not met" />
              )}
              <span className="text-xs bg-slate-800 px-2 py-1 rounded-full text-slate-300 flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {course.credits} Cr
              </span>
            </div>
          </div>

          <h4 className="text-sm text-slate-200 line-clamp-2">{course.title}</h4>

          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex flex-wrap gap-1 text-[11px]">
              {course.requirementArea && (
                <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-400 capitalize">
                  {course.requirementArea === "genEd" ? "gen-ed" : course.requirementArea}
                </span>
              )}
              {course.difficulty && (
                <span className={`px-1.5 py-0.5 rounded bg-white/5 capitalize ${difficultyColor[course.difficulty] ?? "text-slate-400"}`}>
                  {course.difficulty}
                </span>
              )}
            </div>

            {onToggleComplete && (
              <button
                type="button"
                onClick={() => onToggleComplete(course.id)}
                className="text-xs flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors"
                aria-pressed={isCompleted}
                aria-label={isCompleted ? "Mark as not completed" : "Mark as completed"}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {prereqLabels.length > 0 && (
            <div
              className={`text-xs mt-1 ${
                hasUnmetPrereqs ? "text-rose-400" : "text-amber-500/80"
              }`}
            >
              Requires: {prereqLabels.join(", ")}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default CourseCard;
