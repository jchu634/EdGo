import { Schema } from "effect";
import {
  Course,
  ThreadUser,
  ThreadDetailResponse,
  RegionResponse,
  UserResponse,
} from "@/src/lib/schema";
import type { UnreadCountsResponse } from "@/src/lib/stream";

type CourseT = Schema.Schema.Type<typeof Course>;
type ThreadUserT = Schema.Schema.Type<typeof ThreadUser>;
type ThreadDetailRespT = Schema.Schema.Type<typeof ThreadDetailResponse>;
type ThreadDetailT = ThreadDetailRespT["thread"];
type CommentT = ThreadDetailT["comments"][number];
type UserRespT = Schema.Schema.Type<typeof UserResponse>;
type RegionT = Schema.Schema.Type<typeof RegionResponse>;

interface BaseUser {
  id: number;
  name: string;
  avatar: string | null;
}

// ─── Demo users (avatar=null so initials render, no network images) ──────────

export const DEMO_USERS: BaseUser[] = [
  { id: 1, name: "Jamie Rivera", avatar: null },
  { id: 2, name: "Alex Chen", avatar: null },
  { id: 3, name: "Priya Patel", avatar: null },
  { id: 4, name: "Marcus Johnson", avatar: null },
  { id: 5, name: "Sofia Garcia", avatar: null },
  { id: 6, name: "Liam O'Brien", avatar: null },
  { id: 7, name: "Emma Wong", avatar: null },
  { id: 8, name: "Noah Williams", avatar: null },
  { id: 9, name: "Prof. Karen Tate", avatar: null },
  { id: 10, name: "Dr. Robert Kim", avatar: null },
];

function userById(id: number): BaseUser {
  return DEMO_USERS[(id - 1 + DEMO_USERS.length) % DEMO_USERS.length];
}

// ─── Time helpers ───────────────────────────────────────────────────────────

function daysAgoISO(days: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, (days * 7) % 60, 0, 0);
  return d.toISOString();
}

// ─── Courses ────────────────────────────────────────────────────────────────

export const DEMO_COURSES: CourseT[] = [
  {
    id: 1001,
    code: "CS101",
    name: "Intro to Computer Science",
    year: "2025",
    session: "Semester 1",
    status: "active",
    settings: {
      discussion: {
        sortable_feed: true,
        thread_numbers: true,
        readonly: false,
        categories: [
          { name: "General" },
          { name: "Assignments" },
          { name: "Lectures" },
          { name: "Exams" },
        ],
      },
      theme: { logo: "", background: "#70069e", foreground: "#ffffff" },
      role_labels: {
        student: "Student",
        mentor: "Mentor",
        tutor: "Tutor",
        staff: "Staff",
        admin: "Admin",
      },
    },
  },
  {
    id: 1002,
    code: "MATH202",
    name: "Linear Algebra",
    year: "2025",
    session: "Semester 1",
    status: "active",
    settings: {
      discussion: {
        sortable_feed: true,
        thread_numbers: true,
        readonly: false,
        categories: [
          { name: "General" },
          { name: "Problem Sets" },
          { name: "Exams" },
        ],
      },
      theme: { logo: "", background: "#0d74da", foreground: "#ffffff" },
      role_labels: {
        student: "Student",
        mentor: "Mentor",
        tutor: "Tutor",
        staff: "Staff",
        admin: "Admin",
      },
    },
  },
  {
    id: 1003,
    code: "PHYS150",
    name: "Physics I: Mechanics",
    year: "2025",
    session: "Semester 1",
    status: "active",
    settings: {
      discussion: {
        sortable_feed: true,
        thread_numbers: true,
        readonly: false,
        categories: [
          { name: "General" },
          { name: "Labs" },
          { name: "Lectures" },
        ],
      },
      theme: { logo: "", background: "#249a14", foreground: "#ffffff" },
      role_labels: {
        student: "Student",
        mentor: "Mentor",
        tutor: "Tutor",
        staff: "Staff",
        admin: "Admin",
      },
    },
  },
  {
    id: 1004,
    code: "ENG110",
    name: "Academic Writing",
    year: "2025",
    session: "Semester 1",
    status: "active",
    settings: {
      discussion: {
        sortable_feed: true,
        thread_numbers: true,
        readonly: false,
        categories: [
          { name: "General" },
          { name: "Essays" },
          { name: "Peer Review" },
        ],
      },
      theme: { logo: "", background: "#e19e22", foreground: "#ffffff" },
      role_labels: {
        student: "Student",
        mentor: "Mentor",
        tutor: "Tutor",
        staff: "Staff",
        admin: "Admin",
      },
    },
  },
  {
    id: 1005,
    code: "BIO220",
    name: "Cell Biology",
    year: "2025",
    session: "Semester 1",
    status: "active",
    settings: {
      discussion: {
        sortable_feed: true,
        thread_numbers: true,
        readonly: false,
        categories: [{ name: "General" }, { name: "Labs" }, { name: "Quizzes" }],
      },
      theme: { logo: "", background: "#b82a2a", foreground: "#ffffff" },
      role_labels: {
        student: "Student",
        mentor: "Mentor",
        tutor: "Tutor",
        staff: "Staff",
        admin: "Admin",
      },
    },
  },
  {
    id: 1006,
    code: "HIST101",
    name: "Modern World History",
    year: "2024",
    session: "Semester 2",
    status: "archived",
    settings: {
      discussion: {
        sortable_feed: true,
        thread_numbers: true,
        readonly: true,
        categories: [{ name: "General" }, { name: "Exams" }],
      },
      theme: { logo: "", background: "#609a53", foreground: "#ffffff" },
      role_labels: {
        student: "Student",
        mentor: "Mentor",
        tutor: "Tutor",
        staff: "Staff",
        admin: "Admin",
      },
    },
  },
];

// ─── Thread factory ─────────────────────────────────────────────────────────

interface ThreadSeed {
  n: number;
  title: string;
  cat: string;
  sub?: string;
  type?: string;
  uid?: number;
  pinned?: boolean;
  answered?: boolean;
  staff?: boolean;
  student?: boolean;
  anon?: boolean;
  starred?: boolean;
  seen?: boolean;
  voted?: boolean;
  views?: number;
  votes?: number;
  replies?: number;
  stars?: number;
  ageDays?: number;
  updatedDays?: number | null;
  content?: string;
}

const DEFAULT_BODY =
  "<document><paragraph>Looking for some clarification on this topic. Has anyone run into the same issue or can point me to the relevant section in the notes? Thanks!</paragraph></document>";

function buildThread(courseId: number, s: ThreadSeed): ThreadUserT {
  const id = courseId * 1000 + s.n;
  const uid = s.uid ?? ((s.n % 8) + 1);
  const age = s.ageDays ?? s.n * 2;
  const views = s.views ?? 40 + s.n * 17;
  const votes = s.votes ?? 1 + (s.n % 7);
  const replies = s.replies ?? (s.answered ? 2 + (s.n % 5) : s.n % 4);
  const updatedDays =
    s.updatedDays === undefined
      ? age > 1
        ? Math.max(0, age - 1)
        : null
      : s.updatedDays;
  return {
    id,
    user_id: s.anon ? 0 : uid,
    number: s.n,
    type: s.type ?? "question",
    title: s.title,
    content: s.content ?? DEFAULT_BODY,
    document: "",
    category: s.cat,
    subcategory: s.sub ?? "",
    subsubcategory: "",
    star_count: s.stars ?? Math.floor(votes / 2),
    view_count: views,
    unique_view_count: Math.floor(views * 0.7),
    vote_count: votes,
    reply_count: replies,
    is_pinned: s.pinned ?? false,
    is_answered: s.answered ?? false,
    is_student_answered: s.student ?? false,
    is_staff_answered: s.staff ?? false,
    is_anonymous: s.anon ?? false,
    created_at: daysAgoISO(age),
    updated_at: updatedDays === null ? null : daysAgoISO(updatedDays),
    is_starred: s.starred ?? false,
    vote: s.voted ? 1 : null,
    is_seen: s.seen ?? true,
    user: s.anon ? null : userById(uid),
  };
}

// ─── Per-course thread seeds ────────────────────────────────────────────────

const CS101_SEEDS: ThreadSeed[] = [
  {
    n: 1,
    title: "Welcome to CS101 — please read before posting",
    cat: "General",
    uid: 9,
    pinned: true,
    staff: true,
    seen: true,
    views: 412,
    votes: 24,
    stars: 18,
    replies: 3,
    ageDays: 40,
    updatedDays: 5,
  },
  {
    n: 2,
    title: "Assignment 2 deadline extension?",
    cat: "Assignments",
    uid: 2,
    answered: true,
    staff: true,
    seen: false,
    views: 187,
    votes: 11,
    ageDays: 2,
  },
  {
    n: 3,
    title: "Null pointer when calling getNext() on parsed list",
    cat: "Assignments",
    uid: 3,
    answered: true,
    student: true,
    seen: false,
    views: 142,
    votes: 8,
    ageDays: 3,
  },
  {
    n: 4,
    title: "Lecture 9 slides not uploading on Canvas",
    cat: "Lectures",
    uid: 4,
    seen: true,
    views: 98,
    votes: 5,
    ageDays: 4,
  },
  {
    n: 5,
    title: "Big-O analysis of recursive Fibonacci — why O(2^n)?",
    cat: "Lectures",
    uid: 5,
    answered: true,
    staff: true,
    starred: true,
    voted: true,
    seen: false,
    views: 234,
    votes: 19,
    stars: 7,
    ageDays: 6,
  },
  {
    n: 6,
    title: "Midterm scope — are trees included?",
    cat: "Exams",
    uid: 6,
    seen: true,
    views: 156,
    votes: 9,
    ageDays: 5,
  },
  {
    n: 7,
    title: "Setup help: javac not found on Windows",
    cat: "General",
    uid: 7,
    answered: true,
    student: true,
    seen: true,
    views: 73,
    votes: 4,
    ageDays: 8,
  },
  {
    n: 8,
    title: "Anonymous: feeling behind, any advice?",
    cat: "General",
    anon: true,
    seen: true,
    views: 211,
    votes: 27,
    stars: 5,
    ageDays: 7,
  },
  {
    n: 9,
    title: "Assignment 1 Q4 — edge case for empty input?",
    cat: "Assignments",
    uid: 8,
    seen: true,
    views: 64,
    votes: 3,
    ageDays: 9,
  },
  {
    n: 10,
    title: "Recursion vs iteration performance comparison",
    cat: "Lectures",
    uid: 2,
    seen: true,
    views: 89,
    votes: 6,
    ageDays: 11,
  },
  {
    n: 11,
    title: "Lost points on style — where is the rubric?",
    cat: "Assignments",
    uid: 3,
    seen: true,
    views: 47,
    votes: 2,
    ageDays: 13,
  },
  {
    n: 12,
    title: "Study group for final exam?",
    cat: "Exams",
    uid: 4,
    starred: true,
    seen: true,
    views: 132,
    votes: 14,
    stars: 9,
    ageDays: 10,
  },
  {
    n: 13,
    title: "Clarification on generics wildcard syntax",
    cat: "Lectures",
    uid: 5,
    answered: true,
    staff: true,
    seen: true,
    views: 71,
    votes: 5,
    ageDays: 15,
  },
  {
    n: 14,
    title: "IDE recommendation for this course?",
    cat: "General",
    uid: 6,
    seen: true,
    views: 58,
    votes: 3,
    ageDays: 18,
  },
];

const MATH202_SEEDS: ThreadSeed[] = [
  {
    n: 1,
    title: "Problem Set 3 Q2 — eigenvalues of a 3x3 matrix",
    cat: "Problem Sets",
    uid: 3,
    answered: true,
    staff: true,
    seen: false,
    views: 168,
    votes: 12,
    ageDays: 2,
  },
  {
    n: 2,
    title: "Office hours this week cancelled?",
    cat: "General",
    uid: 4,
    seen: true,
    views: 91,
    votes: 5,
    ageDays: 1,
  },
  {
    n: 3,
    title: "Intuition behind diagonalization — when is it possible?",
    cat: "General",
    uid: 5,
    answered: true,
    student: true,
    starred: true,
    voted: true,
    seen: false,
    views: 203,
    votes: 17,
    stars: 6,
    ageDays: 4,
  },
  {
    n: 4,
    title: "Typo in lecture notes page 47?",
    cat: "General",
    uid: 6,
    seen: true,
    views: 54,
    votes: 2,
    ageDays: 5,
  },
  {
    n: 5,
    title: "Row reduction gotcha — partial pivoting",
    cat: "Problem Sets",
    uid: 7,
    answered: true,
    staff: true,
    seen: true,
    views: 112,
    votes: 8,
    ageDays: 6,
  },
  {
    n: 6,
    title: "Exam 2 format — proofs or computations?",
    cat: "Exams",
    uid: 8,
    seen: true,
    views: 144,
    votes: 10,
    ageDays: 7,
  },
  {
    n: 7,
    title: "Anonymous: struggling with vector spaces",
    cat: "General",
    anon: true,
    seen: true,
    views: 187,
    votes: 22,
    ageDays: 8,
  },
  {
    n: 8,
    title: "Determinant properties cheat sheet",
    cat: "Problem Sets",
    uid: 2,
    starred: true,
    seen: true,
    views: 98,
    votes: 13,
    stars: 11,
    ageDays: 9,
  },
  {
    n: 9,
    title: "Gram-Schmidt sign convention question",
    cat: "General",
    uid: 3,
    seen: true,
    views: 61,
    votes: 4,
    ageDays: 12,
  },
  {
    n: 10,
    title: "Are calculators allowed on the midterm?",
    cat: "Exams",
    uid: 4,
    seen: true,
    views: 77,
    votes: 3,
    ageDays: 11,
  },
];

const PHYS150_SEEDS: ThreadSeed[] = [
  {
    n: 1,
    title: "Lab 4 report — uncertainty propagation help",
    cat: "Labs",
    uid: 5,
    answered: true,
    staff: true,
    seen: false,
    views: 134,
    votes: 9,
    ageDays: 2,
  },
  {
    n: 2,
    title: "Friction on an incline — static vs kinetic",
    cat: "Lectures",
    uid: 6,
    seen: true,
    views: 88,
    votes: 5,
    ageDays: 3,
  },
  {
    n: 3,
    title: "Lab 3 make-up session times",
    cat: "Labs",
    uid: 7,
    pinned: true,
    seen: true,
    views: 156,
    votes: 7,
    ageDays: 6,
  },
  {
    n: 4,
    title: "Conservation of energy vs momentum — when to use which?",
    cat: "Lectures",
    uid: 8,
    answered: true,
    student: true,
    seen: true,
    views: 142,
    votes: 11,
    ageDays: 5,
  },
  {
    n: 5,
    title: "Anonymous: how to prepare for the final?",
    cat: "General",
    anon: true,
    seen: true,
    views: 198,
    votes: 24,
    stars: 8,
    ageDays: 7,
  },
  {
    n: 6,
    title: "Projectile motion — sign of g convention",
    cat: "Lectures",
    uid: 2,
    seen: true,
    views: 64,
    votes: 3,
    ageDays: 9,
  },
  {
    n: 7,
    title: "Lab notebook grading rubric?",
    cat: "Labs",
    uid: 3,
    seen: true,
    views: 47,
    votes: 2,
    ageDays: 10,
  },
  {
    n: 8,
    title: "Free body diagram for coupled blocks",
    cat: "Lectures",
    uid: 4,
    starred: true,
    seen: true,
    views: 93,
    votes: 8,
    stars: 4,
    ageDays: 12,
  },
];

const ENG110_SEEDS: ThreadSeed[] = [
  {
    n: 1,
    title: "Essay 2 prompt — is the word count strict?",
    cat: "Essays",
    uid: 7,
    answered: true,
    staff: true,
    seen: false,
    views: 112,
    votes: 8,
    ageDays: 2,
  },
  {
    n: 2,
    title: "Peer review guidelines for draft 1",
    cat: "Peer Review",
    uid: 9,
    pinned: true,
    seen: true,
    views: 143,
    votes: 10,
    ageDays: 7,
  },
  {
    n: 3,
    title: "Thesis statement feedback please",
    cat: "Essays",
    uid: 8,
    seen: true,
    views: 76,
    votes: 4,
    ageDays: 3,
  },
  {
    n: 4,
    title: "Citation style — MLA or APA?",
    cat: "General",
    uid: 2,
    answered: true,
    student: true,
    seen: true,
    views: 98,
    votes: 6,
    ageDays: 5,
  },
  {
    n: 5,
    title: "Anonymous: nervous about first submission",
    cat: "General",
    anon: true,
    seen: true,
    views: 167,
    votes: 19,
    ageDays: 4,
  },
  {
    n: 6,
    title: "Workshop sign-up sheet link",
    cat: "Peer Review",
    uid: 3,
    seen: true,
    views: 54,
    votes: 2,
    ageDays: 8,
  },
  {
    n: 7,
    title: "How long should the reflection be?",
    cat: "Essays",
    uid: 4,
    seen: true,
    views: 41,
    votes: 2,
    ageDays: 9,
  },
];

const BIO220_SEEDS: ThreadSeed[] = [
  {
    n: 1,
    title: "Quiz 3 material — chapters covered?",
    cat: "Quizzes",
    uid: 4,
    answered: true,
    staff: true,
    seen: false,
    views: 121,
    votes: 9,
    ageDays: 1,
  },
  {
    n: 2,
    title: "Lab 2 — microscope calibration steps",
    cat: "Labs",
    uid: 5,
    seen: true,
    views: 84,
    votes: 5,
    ageDays: 3,
  },
  {
    n: 3,
    title: "Mitosis vs meiosis diagram clarification",
    cat: "General",
    uid: 6,
    answered: true,
    student: true,
    starred: true,
    voted: true,
    seen: true,
    views: 156,
    votes: 13,
    stars: 7,
    ageDays: 5,
  },
  {
    n: 4,
    title: "Anonymous: tips for memorizing pathways?",
    cat: "General",
    anon: true,
    seen: true,
    views: 178,
    votes: 21,
    ageDays: 6,
  },
  {
    n: 5,
    title: "Lab report formatting question",
    cat: "Labs",
    uid: 7,
    seen: true,
    views: 49,
    votes: 2,
    ageDays: 8,
  },
  {
    n: 6,
    title: "Cell membrane transport mechanisms summary",
    cat: "General",
    uid: 8,
    starred: true,
    seen: true,
    views: 102,
    votes: 11,
    stars: 9,
    ageDays: 10,
  },
];

const HIST101_SEEDS: ThreadSeed[] = [
  {
    n: 1,
    title: "Final exam essay topics posted",
    cat: "Exams",
    uid: 9,
    pinned: true,
    staff: true,
    seen: true,
    views: 287,
    votes: 18,
    ageDays: 120,
    updatedDays: 90,
  },
  {
    n: 2,
    title: "Primary source analysis — how to cite?",
    cat: "General",
    uid: 3,
    answered: true,
    staff: true,
    seen: true,
    views: 134,
    votes: 8,
    ageDays: 130,
  },
  {
    n: 3,
    title: "Study guide for the Cold War unit",
    cat: "Exams",
    uid: 4,
    starred: true,
    seen: true,
    views: 176,
    votes: 15,
    stars: 10,
    ageDays: 125,
  },
  {
    n: 4,
    title: "Anonymous: feedback on the course?",
    cat: "General",
    anon: true,
    seen: true,
    views: 203,
    votes: 26,
    ageDays: 140,
  },
];

function buildCourseThreads(courseId: number, seeds: ThreadSeed[]): ThreadUserT[] {
  return seeds.map((s) => buildThread(courseId, s));
}

export const DEMO_THREADS_BY_COURSE: Record<number, ThreadUserT[]> = {
  1001: buildCourseThreads(1001, CS101_SEEDS),
  1002: buildCourseThreads(1002, MATH202_SEEDS),
  1003: buildCourseThreads(1003, PHYS150_SEEDS),
  1004: buildCourseThreads(1004, ENG110_SEEDS),
  1005: buildCourseThreads(1005, BIO220_SEEDS),
  1006: buildCourseThreads(1006, HIST101_SEEDS),
};

export function allDemoCourseIds(): number[] {
  return Object.keys(DEMO_THREADS_BY_COURSE).map(Number);
}

// ─── Comment factory ────────────────────────────────────────────────────────

interface CommentSeed {
  uid: number;
  type?: "comment" | "answer";
  content: string;
  endorsed?: boolean;
  anon?: boolean;
  votes?: number;
  voted?: boolean;
  ageDays?: number;
  replies?: CommentSeed[];
}

function buildComments(
  seed: CommentSeed,
  courseId: number,
  threadId: number,
  counter: { n: number },
  parentNumber: number,
): CommentT {
  const myNumber = counter.n++;
  const id = threadId * 1000 + myNumber;
  const replies =
    seed.replies?.map((r) =>
      buildComments(r, courseId, threadId, counter, myNumber),
    ) ?? [];
  return {
    id,
    user_id: seed.anon ? 0 : seed.uid,
    course_id: courseId,
    thread_id: threadId,
    original_id: null,
    parent_id: parentNumber === 0 ? null : threadId * 1000 + parentNumber,
    editor_id: null,
    number: myNumber,
    type: seed.type ?? "comment",
    kind: seed.type ?? "comment",
    content: seed.content,
    document: "",
    flag_count: 0,
    vote_count: seed.votes ?? (seed.endorsed ? 5 : 2),
    is_endorsed: seed.endorsed ?? false,
    is_anonymous: seed.anon ?? false,
    is_private: false,
    is_resolved: false,
    created_by_bot_id: null,
    created_at: daysAgoISO(seed.ageDays ?? 1),
    updated_at: null,
    deleted_at: null,
    anonymous_id: null,
    vote: seed.voted ? 1 : null,
    comments: replies,
  };
}

function freshCounter(): { n: number } {
  return { n: 1 };
}

// ─── Rich thread-detail fixtures (keyed by `${courseId}:${threadNumber}`) ────

const RICH_CONTENT_CS101_2 =
  "<document><paragraph>Hi everyone, the syllabus lists Assignment 2 as due this Friday, but the starter code was only published yesterday. Will the deadline be extended?</paragraph></document>";

const RICH_CONTENT_CS101_3 =
  "<document><paragraph>I'm getting a <bold>null pointer exception</bold> when calling <code>getNext()</code> on the parsed list below.</paragraph><codeblock>ListNode head = parser.parse(input);\nhead.getNext(); // throws NPE</codeblock><paragraph>I've confirmed that <code>input</code> is non-empty. Any ideas what I'm missing?</paragraph><heading number=\"2\">What I've tried</heading><list><list-item>Printing the input — it looks correct</list-item><list-item>Stepping through with the debugger</list-item><list-item>Checking for off-by-one in the parser</list-item></list></document>";

const RICH_CONTENT_CS101_5 =
  "<document><paragraph>In lecture we said the naive recursive Fibonacci runs in <code>O(2^n)</code>, but I'm having trouble seeing where the factor of 2 comes from.</paragraph><heading number=\"2\">My understanding</heading><paragraph>Each call branches into two sub-calls, so the recurrence is <code>T(n) = 2*T(n-1) + O(1)</code>, which solves to <code>O(2^n)</code>. Is that the right way to think about it?</paragraph><heading number=\"2\">Follow-up</heading><paragraph>And why does memoization bring it down to <code>O(n)</code>? Thanks!</paragraph></document>";

const RICH_CONTENT_MATH202_1 =
  "<document><paragraph>For Problem Set 3 Q2, I'm stuck finding the eigenvalues of this matrix:</paragraph><codeblock>A = | 2  1  0 |\n    | 1  2  1 |\n    | 0  1  2 |</codeblock><paragraph>I set up <code>det(A - lambda*I) = 0</code> but my characteristic polynomial looks messy. Could someone walk me through the first steps?</paragraph></document>";

const RICH_CONTENT_MATH202_3 =
  "<document><paragraph>I understand <italic>what</italic> diagonalization is (<code>A = P D P^-1</code>), but I don't have great intuition for <italic>when</italic> a matrix is diagonalizable.</paragraph><heading number=\"2\">My question</heading><list><list-item>Is it enough that all eigenvalues are distinct?</list-item><list-item>What happens with repeated eigenvalues?</list-item></list><paragraph>Any concrete examples would really help. Thanks!</paragraph></document>";

const RICH_CONTENT_PHYS150_1 =
  "<document><paragraph>For Lab 4 we need to propagate uncertainty through <code>g = (4*pi^2*L) / T^2</code>, and I'm unsure how to combine the relative errors in <code>L</code> and <code>T</code>.</paragraph><paragraph>Should I be adding relative uncertainties in quadrature? The lab manual isn't totally clear.</paragraph></document>";

function detailFromSeed(
  courseId: number,
  threadNumber: number,
  content: string,
  commentSeeds: CommentSeed[],
): ThreadDetailRespT {
  const listThread = DEMO_THREADS_BY_COURSE[courseId].find(
    (t) => t.number === threadNumber,
  );
  if (!listThread) throw new Error("missing seed thread");
  const { user: _user, ...threadFields } = listThread;
  void _user;
  const counter = freshCounter();
  const comments = commentSeeds
    .filter((c) => c.type !== "answer")
    .map((c) => buildComments(c, courseId, listThread.id, counter, 0));
  const answers = commentSeeds
    .filter((c) => c.type === "answer")
    .map((c) => buildComments(c, courseId, listThread.id, counter, 0));
  const thread: ThreadDetailT = {
    ...threadFields,
    content,
    comments,
    answers,
  };
  return { thread, users: DEMO_USERS };
}

const RICH_DETAILS: Record<string, ThreadDetailRespT> = {
  "1001:2": detailFromSeed(1001, 2, RICH_CONTENT_CS101_2, [
    {
      uid: 9,
      type: "answer",
      content:
        "<document><paragraph>Yes — the deadline is extended to <bold>next Tuesday at 11:59pm</bold>. Sorry for the short notice on the starter code.</paragraph></document>",
      endorsed: true,
      votes: 8,
      ageDays: 1,
    },
    {
      uid: 2,
      content:
        "<document><paragraph>Thank you! That's a huge relief.</paragraph></document>",
      votes: 2,
      ageDays: 1,
      replies: [
        {
          uid: 5,
          content:
            "<document><paragraph>Agreed, really appreciate the extension.</paragraph></document>",
          votes: 1,
          ageDays: 1,
        },
      ],
    },
  ]),
  "1001:3": detailFromSeed(1001, 3, RICH_CONTENT_CS101_3, [
    {
      uid: 5,
      type: "answer",
      content:
        "<document><paragraph>Your <code>parse</code> method returns the <italic>sentinel</italic> node when the input has a single token, so <code>getNext()</code> on the sentinel is null. Guard against it:</paragraph><codeblock>if (head != SENTINEL) {\n  head.getNext();\n}</codeblock></document>",
      endorsed: true,
      votes: 6,
      ageDays: 2,
    },
    {
      uid: 3,
      content:
        "<document><paragraph>That was exactly it — thank you! Added the guard and it works now.</paragraph></document>",
      votes: 3,
      ageDays: 2,
    },
  ]),
  "1001:5": detailFromSeed(1001, 5, RICH_CONTENT_CS101_5, [
    {
      uid: 9,
      type: "answer",
      content:
        "<document><paragraph>Your reasoning is exactly right. Each call spawns two more, giving the <code>2^n</code> leaves on the recursion tree.</paragraph><heading number=\"2\">Why memoization helps</heading><paragraph>There are only <code>n</code> distinct subproblems (<code>F(0)..F(n)</code>). Memoization ensures each is solved once, so the work becomes <code>O(n)</code>.</paragraph></document>",
      endorsed: true,
      votes: 11,
      ageDays: 5,
    },
    {
      uid: 5,
      content:
        "<document><paragraph>The recursion-tree framing finally clicked for me. Much appreciated!</paragraph></document>",
      votes: 2,
      ageDays: 5,
    },
  ]),
  "1002:1": detailFromSeed(1002, 1, RICH_CONTENT_MATH202_1, [
    {
      uid: 9,
      type: "answer",
      content:
        "<document><paragraph>Expand along the first row. You'll get:</paragraph><codeblock>det(A - L*I) = (2-L)[(2-L)^2 - 1] - 1[(2-L) - 0]\n             = -(L-2)(L^2 - 4L + 3)\n             = -(L-1)(L-2)(L-3)</codeblock><paragraph>So the eigenvalues are <code>L = 1, 2, 3</code>.</paragraph></document>",
      endorsed: true,
      votes: 9,
      ageDays: 1,
    },
    {
      uid: 3,
      content:
        "<document><paragraph>Beautiful, I dropped a sign on the middle term. Got it now, thanks!</paragraph></document>",
      votes: 2,
      ageDays: 1,
    },
  ]),
  "1002:3": detailFromSeed(1002, 3, RICH_CONTENT_MATH202_3, [
    {
      uid: 4,
      type: "answer",
      content:
        "<document><paragraph>A matrix is diagonalizable iff the geometric multiplicity of each eigenvalue equals its algebraic multiplicity.</paragraph><paragraph>Distinct eigenvalues always satisfy this (each has geom. mult. >= 1 and they sum to <code>n</code>). Repeated eigenvalues can fail — the classic example is a Jordan block.</paragraph></document>",
      endorsed: true,
      votes: 7,
      ageDays: 3,
    },
    {
      uid: 5,
      content:
        "<document><paragraph>The Jordan block example makes it concrete. Thank you!</paragraph></document>",
      votes: 1,
      ageDays: 3,
    },
  ]),
  "1003:1": detailFromSeed(1003, 1, RICH_CONTENT_PHYS150_1, [
    {
      uid: 9,
      type: "answer",
      content:
        "<document><paragraph>Yes — for a product/quotient, add relative uncertainties in quadrature. For <code>g = 4*pi^2*L / T^2</code>:</paragraph><codeblock>(dg/g)^2 = (dL/L)^2 + (2*dT/T)^2</codeblock><paragraph>Note the factor of 2 on the period term, since <code>T</code> is squared.</paragraph></document>",
      endorsed: true,
      votes: 6,
      ageDays: 1,
    },
  ]),
};

// ─── Synthesized fallback detail for threads without a rich fixture ─────────

function synthesizeDetail(
  courseId: number,
  threadNumber: number,
): ThreadDetailRespT | null {
  const listThread = DEMO_THREADS_BY_COURSE[courseId]?.find(
    (t) => t.number === threadNumber,
  );
  if (!listThread) return null;
  const { user: _user, ...threadFields } = listThread;
  void _user;
  const counter = freshCounter();
  const comments: CommentT[] = [];
  const answers: CommentT[] = [];
  if (listThread.is_staff_answered || listThread.is_answered) {
    answers.push(
      buildComments(
        {
          uid: 9,
          type: "answer",
          content:
            "<document><paragraph>Great question — here's a quick clarification. Let me know if anything is still unclear!</paragraph></document>",
          endorsed: true,
          votes: 4,
          ageDays: 1,
        },
        courseId,
        listThread.id,
        counter,
        0,
      ),
    );
  }
  comments.push(
    buildComments(
      {
        uid: 2,
        content:
          "<document><paragraph>Thanks for posting this, I had the same question.</paragraph></document>",
        votes: 2,
        ageDays: 1,
      },
      courseId,
      listThread.id,
      counter,
      0,
    ),
  );
  const thread: ThreadDetailT = {
    ...threadFields,
    comments,
    answers,
  };
  return { thread, users: DEMO_USERS };
}

export function getDemoThreadDetail(
  courseId: number,
  threadNumber: number,
): ThreadDetailRespT | null {
  const key = `${courseId}:${threadNumber}`;
  return RICH_DETAILS[key] ?? synthesizeDetail(courseId, threadNumber);
}

// ─── Thread list / search helpers ───────────────────────────────────────────

export function getDemoThreads(
  courseId: number,
  options?: {
    category?: string;
    offset?: number;
    sort?: string;
    limit?: number;
  },
): { threads: ThreadUserT[]; users: BaseUser[] } {
  const { category, offset = 0, sort = "new", limit = 100 } = options ?? {};
  let threads = DEMO_THREADS_BY_COURSE[courseId] ?? [];
  if (category) threads = threads.filter((t) => t.category === category);

  const sorted = [...threads];
  switch (sort) {
    case "old":
    case "oldest":
      sorted.sort((a, b) => a.number - b.number);
      break;
    case "top":
      sorted.sort((a, b) => b.vote_count - a.vote_count);
      break;
    case "new":
    case "newest":
    default:
      sorted.sort((a, b) => b.number - a.number);
      break;
  }
  const sliced = sorted.slice(offset, offset + limit);
  return { threads: sliced, users: DEMO_USERS };
}

export function searchDemoThreads(
  courseId: number,
  query: string,
  options?: { sort?: string; limit?: number },
): { threads: ThreadUserT[]; users: BaseUser[] } {
  const { sort = "relevance", limit = 20 } = options ?? {};
  const q = query.trim().toLowerCase();
  let threads = DEMO_THREADS_BY_COURSE[courseId] ?? [];
  if (q.length > 0) {
    threads = threads.filter((t) => t.title.toLowerCase().includes(q));
  }
  const sorted = [...threads];
  const inQuery = (t: ThreadUserT) => t.title.toLowerCase().includes(q);
  switch (sort) {
    case "newest":
      sorted.sort((a, b) => b.number - a.number);
      break;
    case "oldest":
      sorted.sort((a, b) => a.number - a.number);
      break;
    case "relevance":
    default:
      sorted.sort((a, b) => {
        const ai = inQuery(a) ? 0 : 1;
        const bi = inQuery(b) ? 0 : 1;
        if (ai !== bi) return ai - bi;
        return b.vote_count - a.vote_count;
      });
      break;
  }
  return { threads: sorted.slice(0, limit), users: DEMO_USERS };
}

// ─── Top-level API responses ────────────────────────────────────────────────

export const demoUserResponse: UserRespT = {
  courses: DEMO_COURSES.map((course) => ({
    course,
    role: {
      user_id: 1,
      course_id: course.id,
      role: "student",
    },
    last_active: daysAgoISO(1),
  })),
  push_key: "demo-push-key",
  user: {
    id: 1,
    name: "Jamie Rivera",
    avatar: null,
    email: "jamie.rivera@uni.edu",
    username: "jamie.r",
    settings: {
      accessible: false,
      tz: "America/New_York",
      theme: "os",
      digest_interval: null,
      discuss_feed_style: "flat",
      locale: "en",
      character_key_shortcuts_disabled: false,
      set_tz_automatically: true,
      reply_via_email: true,
      email_announcements: true,
      email_watched_threads: false,
      email_thread_replies: true,
      email_comment_replies: true,
      email_mentions: true,
      mention_direct_message_digest_interval: "hourly",
      channel_digest_interval: "hourly",
      allow_password_login: true,
      desktop_notifications_enabled: false,
      desktop_notifications_scopes: {
        announcement: true,
        thread: true,
        direct_reply: true,
        mention: true,
        chat: false,
        watch: false,
      },
      snooze_end: "",
      lexical_access: null,
      lexical_access_desktop: null,
      lexical_access_mobile: null,
      lexical_table: false,
      deactivated: false,
    },
  },
};

export const demoRegion: RegionT = {
  country_code: "US",
  default_region: "us",
};

export const demoUnreadCounts: UnreadCountsResponse = {
  id: 1,
  type: "thread.unreadCounts",
  data: {
    "1001": { unread: 7 },
    "1002": { unread: 3 },
    "1003": { unread: 12 },
    "1004": { unread: 0 },
    "1005": { unread: 2 },
    "1006": { unread: 0 },
  },
};
