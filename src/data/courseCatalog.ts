/**
 * Static course catalog for the Interactive Degree Roadmap Planner.
 *
 * This is intentionally a hand-authored dataset (rather than a DB collection) so
 * the planner works out-of-the-box in every environment, including the offline
 * MockDB fallback. The backend seeds this into the `course_catalog` collection on
 * first read; edits here flow through on the next cold read of an empty catalog.
 *
 * `requirementArea` maps each course onto a graduation bucket:
 *   - core   : required CS backbone
 *   - elective : upper-division CS / math / science depth
 *   - genEd  : communication, humanities, business breadth
 */

export type Term = "Fall" | "Spring" | "Summer";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type RequirementArea = "core" | "elective" | "genEd";

export interface CatalogCourse {
  id: string;
  code: string;
  title: string;
  department: string;
  credits: number;
  description: string;
  prerequisites: string[];
  corequisites: string[];
  termsOffered: Term[];
  difficulty: Difficulty;
  requirementArea: RequirementArea;
}

export interface GraduationRequirements {
  totalCreditsRequired: number;
  coreCreditsRequired: number;
  electiveCreditsRequired: number;
  genEdCreditsRequired: number;
}

export const DEFAULT_GRADUATION_REQUIREMENTS: GraduationRequirements = {
  totalCreditsRequired: 120,
  coreCreditsRequired: 45,
  electiveCreditsRequired: 30,
  genEdCreditsRequired: 18,
};

/** Typical maximum credit load per semester before a warning is raised. */
export const MAX_RECOMMENDED_SEMESTER_CREDITS = 18;

export const COURSE_CATALOG: CatalogCourse[] = [
  // ── Foundational CS core ──────────────────────────────────────────
  {
    id: "CS101",
    code: "CS 101",
    title: "Introduction to Programming",
    department: "Computer Science",
    credits: 3,
    description: "Fundamentals of programming: variables, control flow, functions, and problem decomposition.",
    prerequisites: [],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "beginner",
    requirementArea: "core",
  },
  {
    id: "CS102",
    code: "CS 102",
    title: "Data Structures",
    department: "Computer Science",
    credits: 4,
    description: "Arrays, linked lists, stacks, queues, trees, hash tables, and their complexity trade-offs.",
    prerequisites: ["CS101"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "beginner",
    requirementArea: "core",
  },
  {
    id: "CS210",
    code: "CS 210",
    title: "Computer Organization",
    department: "Computer Science",
    credits: 3,
    description: "Machine representation, assembly, the memory hierarchy, and how code becomes hardware behaviour.",
    prerequisites: ["CS102"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "intermediate",
    requirementArea: "core",
  },
  {
    id: "CS220",
    code: "CS 220",
    title: "Discrete Mathematics",
    department: "Computer Science",
    credits: 3,
    description: "Logic, sets, relations, induction, combinatorics, and graph theory for computer scientists.",
    prerequisites: ["MATH101"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "intermediate",
    requirementArea: "core",
  },
  {
    id: "CS201",
    code: "CS 201",
    title: "Algorithms",
    department: "Computer Science",
    credits: 4,
    description: "Design and analysis of algorithms: divide and conquer, greedy, dynamic programming, graph algorithms.",
    prerequisites: ["CS102", "CS220"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "intermediate",
    requirementArea: "core",
  },
  {
    id: "CS301",
    code: "CS 301",
    title: "Operating Systems",
    department: "Computer Science",
    credits: 4,
    description: "Processes, threads, scheduling, virtual memory, concurrency, and file systems.",
    prerequisites: ["CS210", "CS201"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "advanced",
    requirementArea: "core",
  },
  {
    id: "CS320",
    code: "CS 320",
    title: "Software Engineering",
    department: "Computer Science",
    credits: 3,
    description: "Requirements, design patterns, testing, version control, and working effectively in teams.",
    prerequisites: ["CS201"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "intermediate",
    requirementArea: "core",
  },
  {
    id: "CS340",
    code: "CS 340",
    title: "Theory of Computation",
    department: "Computer Science",
    credits: 3,
    description: "Finite automata, regular and context-free languages, Turing machines, and decidability.",
    prerequisites: ["CS220", "CS201"],
    corequisites: [],
    termsOffered: ["Fall"],
    difficulty: "advanced",
    requirementArea: "core",
  },
  {
    id: "CS450",
    code: "CS 450",
    title: "Senior Capstone Project",
    department: "Computer Science",
    credits: 4,
    description: "Team-based, semester-long build of a substantial software system with a real stakeholder.",
    prerequisites: ["CS320", "CS310"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "advanced",
    requirementArea: "core",
  },

  // ── CS electives (upper division) ─────────────────────────────────
  {
    id: "CS310",
    code: "CS 310",
    title: "Database Systems",
    department: "Computer Science",
    credits: 3,
    description: "Relational modelling, SQL, indexing, transactions, and an introduction to distributed stores.",
    prerequisites: ["CS102"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "intermediate",
    requirementArea: "elective",
  },
  {
    id: "CS330",
    code: "CS 330",
    title: "Computer Networks",
    department: "Computer Science",
    credits: 3,
    description: "The Internet protocol stack, socket programming, routing, congestion control, and network security.",
    prerequisites: ["CS210"],
    corequisites: [],
    termsOffered: ["Spring"],
    difficulty: "intermediate",
    requirementArea: "elective",
  },
  {
    id: "CS401",
    code: "CS 401",
    title: "Machine Learning",
    department: "Computer Science",
    credits: 3,
    description: "Supervised and unsupervised learning, model evaluation, regularisation, and neural networks.",
    prerequisites: ["CS201", "MATH210", "STAT201"],
    corequisites: [],
    termsOffered: ["Fall"],
    difficulty: "advanced",
    requirementArea: "elective",
  },
  {
    id: "CS410",
    code: "CS 410",
    title: "Compiler Construction",
    department: "Computer Science",
    credits: 3,
    description: "Lexing, parsing, semantic analysis, IR generation, and optimisation of a small language.",
    prerequisites: ["CS340", "CS210"],
    corequisites: [],
    termsOffered: ["Spring"],
    difficulty: "advanced",
    requirementArea: "elective",
  },
  {
    id: "CS420",
    code: "CS 420",
    title: "Distributed Systems",
    department: "Computer Science",
    credits: 3,
    description: "Replication, consensus, fault tolerance, consistency models, and large-scale system design.",
    prerequisites: ["CS301", "CS330"],
    corequisites: [],
    termsOffered: ["Fall"],
    difficulty: "advanced",
    requirementArea: "elective",
  },

  // ── Mathematics & science (count as electives) ────────────────────
  {
    id: "MATH101",
    code: "MATH 101",
    title: "Calculus I",
    department: "Mathematics",
    credits: 4,
    description: "Limits, derivatives, and an introduction to integration with applications.",
    prerequisites: [],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "beginner",
    requirementArea: "elective",
  },
  {
    id: "MATH201",
    code: "MATH 201",
    title: "Calculus II",
    department: "Mathematics",
    credits: 4,
    description: "Techniques of integration, sequences and series, and parametric and polar curves.",
    prerequisites: ["MATH101"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "intermediate",
    requirementArea: "elective",
  },
  {
    id: "MATH210",
    code: "MATH 210",
    title: "Linear Algebra",
    department: "Mathematics",
    credits: 3,
    description: "Vector spaces, matrices, determinants, eigenvalues, and linear transformations.",
    prerequisites: ["MATH101"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "intermediate",
    requirementArea: "elective",
  },
  {
    id: "STAT201",
    code: "STAT 201",
    title: "Probability & Statistics",
    department: "Mathematics",
    credits: 3,
    description: "Probability models, random variables, estimation, hypothesis testing, and regression.",
    prerequisites: ["MATH201"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "intermediate",
    requirementArea: "elective",
  },
  {
    id: "PHYS101",
    code: "PHYS 101",
    title: "Physics I: Mechanics",
    department: "Physics",
    credits: 4,
    description: "Kinematics, Newton's laws, energy, momentum, and rotational motion with a lab.",
    prerequisites: [],
    corequisites: ["MATH101"],
    termsOffered: ["Fall", "Spring"],
    difficulty: "beginner",
    requirementArea: "elective",
  },
  {
    id: "PHYS102",
    code: "PHYS 102",
    title: "Physics II: Electricity & Magnetism",
    department: "Physics",
    credits: 4,
    description: "Electric fields, circuits, magnetism, and electromagnetic induction with a lab.",
    prerequisites: ["PHYS101", "MATH201"],
    corequisites: [],
    termsOffered: ["Spring"],
    difficulty: "intermediate",
    requirementArea: "elective",
  },

  // ── General education / breadth ───────────────────────────────────
  {
    id: "ENG101",
    code: "ENG 101",
    title: "Academic Writing",
    department: "English",
    credits: 3,
    description: "Argument, evidence, revision, and clear expository prose across disciplines.",
    prerequisites: [],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "beginner",
    requirementArea: "genEd",
  },
  {
    id: "ENG201",
    code: "ENG 201",
    title: "Technical Communication",
    department: "English",
    credits: 3,
    description: "Documentation, specifications, presentations, and writing for technical audiences.",
    prerequisites: ["ENG101"],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "intermediate",
    requirementArea: "genEd",
  },
  {
    id: "ECON101",
    code: "ECON 101",
    title: "Principles of Economics",
    department: "Economics",
    credits: 3,
    description: "Supply and demand, markets, incentives, and an introduction to macroeconomic policy.",
    prerequisites: [],
    corequisites: [],
    termsOffered: ["Fall", "Spring"],
    difficulty: "beginner",
    requirementArea: "genEd",
  },
  {
    id: "HUM101",
    code: "HUM 101",
    title: "Ethics in Technology",
    department: "Humanities",
    credits: 3,
    description: "Privacy, algorithmic bias, automation, and the social responsibilities of engineers.",
    prerequisites: [],
    corequisites: [],
    termsOffered: ["Fall", "Spring", "Summer"],
    difficulty: "beginner",
    requirementArea: "genEd",
  },
  {
    id: "BUS201",
    code: "BUS 201",
    title: "Technology Entrepreneurship",
    department: "Business",
    credits: 3,
    description: "Opportunity assessment, lean validation, go-to-market, and pitching a venture.",
    prerequisites: [],
    corequisites: [],
    termsOffered: ["Spring", "Summer"],
    difficulty: "intermediate",
    requirementArea: "genEd",
  },
];

export function getCourseCatalog(): CatalogCourse[] {
  return COURSE_CATALOG.map((c) => ({ ...c }));
}

export function getCourseById(id: string): CatalogCourse | undefined {
  return COURSE_CATALOG.find((c) => c.id === id);
}
