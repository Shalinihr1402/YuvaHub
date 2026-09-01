import React from "react";
import { GraduationCap, CheckCircle2, CircleDashed } from "lucide-react";

export interface RequirementProgress {
  area: "core" | "elective" | "genEd" | "total";
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

const AREA_LABELS: Record<string, string> = {
  core: "Core requirements",
  elective: "Electives & depth",
  genEd: "General education",
  total: "Total credits",
};

const barColor = (pct: number) =>
  pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-500";

interface Props {
  progress: GraduationProgress | null;
}

export const ProgressTracker: React.FC<Props> = ({ progress }) => {
  if (!progress) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 text-sm text-slate-500">
        Progress will appear once your catalog loads.
      </div>
    );
  }

  const rows = progress.breakdown.filter((r) => r.area !== "total");
  const total = progress.breakdown.find((r) => r.area === "total");

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-blue-400" />
          Graduation Progress
        </h3>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            progress.onTrack
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-amber-500/10 text-amber-400"
          }`}
        >
          {progress.onTrack ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Plan meets credit target
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <CircleDashed className="w-3 h-3" /> {" "}
              {Math.max(
                0,
                progress.totalCreditsRequired - progress.totalCreditsPlanned,
              )}{" "}
              credits to plan
            </span>
          )}
        </span>
      </div>

      {/* Headline bar */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-300">
            {progress.totalCreditsPlanned} / {progress.totalCreditsRequired} credits planned
          </span>
          <span className="text-slate-400">{total?.percentComplete ?? progress.percentComplete}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor(
              total?.percentComplete ?? progress.percentComplete,
            )}`}
            style={{ width: `${total?.percentComplete ?? progress.percentComplete}%` }}
          />
        </div>
        {progress.totalCreditsEarned > 0 && (
          <p className="text-xs text-slate-500 mt-1">
            {progress.totalCreditsEarned} credits already completed
          </p>
        )}
      </div>

      {/* Breakdown by requirement area */}
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.area}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">{AREA_LABELS[r.area] ?? r.area}</span>
              <span className="text-slate-500">
                {r.plannedCredits} / {r.requiredCredits}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor(r.percentComplete)}`}
                style={{ width: `${r.percentComplete}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-white/5">
        <span>{progress.semestersUsed} semesters in use</span>
        <span>{progress.semestersRemaining} semesters free</span>
      </div>
    </div>
  );
};

export default ProgressTracker;
