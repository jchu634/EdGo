import {
  int,
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";

export const threadsTable = sqliteTable(
  "threads",
  {
    id: int("id").primaryKey(),
    courseId: int("course_id").notNull(),
    title: text("title").notNull(),
    number: int("number").notNull(),
    userId: int("user_id").notNull(),
    type: text("type").notNull(),
    content: text("content").notNull(),
    document: text("document").default("").notNull(),
    category: text("category").default("").notNull(),
    subcategory: text("subcategory").default("").notNull(),
    subsubcategory: text("subsubcategory").default("").notNull(),
    starCount: integer("star_count").default(0).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    voteCount: integer("vote_count").default(0).notNull(),
    replyCount: integer("reply_count").default(0).notNull(),
    isPinned: integer("is_pinned", { mode: "boolean" })
      .default(false)
      .notNull(),
    isAnswered: integer("is_answered", { mode: "boolean" })
      .default(false)
      .notNull(),
    isStudentAnswered: integer("is_student_answered", { mode: "boolean" })
      .default(false)
      .notNull(),
    isStaffAnswered: integer("is_staff_answered", { mode: "boolean" })
      .default(false)
      .notNull(),
    isAnonymous: integer("is_anonymous", { mode: "boolean" })
      .default(false)
      .notNull(),
    user: text("user", { mode: "json" }).$type<{
      id: number;
      name: string;
      avatar: string | null;
    } | null>(),
  },
  (table) => [index("threads_course_id_idx").on(table.courseId)],
);

export type Thread = typeof threadsTable.$inferSelect;
export type NewThread = typeof threadsTable.$inferInsert;
