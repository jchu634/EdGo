import { Schema } from "effect";

export const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  avatar: Schema.NullOr(Schema.String),
  // course_role: Schema.Literal("admin", "student"),
});

const userSettings = Schema.Struct({
  tz: Schema.String,
});

export const CourseCategory = Schema.Struct({
  name: Schema.String,
  // Don't want to deal with those yet, those are a pita
  // subcategories:
});

export const ExtendedUser = Schema.Struct({
  ...User.fields,
  email: Schema.String,
  username: Schema.NullOr(Schema.String),
  avatar_url: Schema.NullOr(Schema.String),
  settings: userSettings,
});

export const Course = Schema.Struct({
  id: Schema.Number,
  code: Schema.String,
  name: Schema.String,
  year: Schema.String,
  session: Schema.String,
  settings: Schema.Struct({
    discussion: Schema.Struct({
      sortable_feed: Schema.Boolean,
      // default_feed_sort_order: Schema.NullOr(Schema.String),
      thread_numbers: Schema.Boolean,
      readonly: Schema.Boolean,
      categories: Schema.NullOr(Schema.Array(CourseCategory)),
    }),
    theme: Schema.Struct({
      logo: Schema.String,
      background: Schema.String,
      foreground: Schema.String,
    }),
    role_labels: Schema.Struct({
      student: Schema.String,
      mentor: Schema.String,
      tutor: Schema.String,
      staff: Schema.String,
      admin: Schema.String,
    }),
  }),
});

export const EdComment: Schema.Schema<{
  readonly id: number;
  readonly user_id: number;
  readonly course_id: number;
  readonly thread_id: number;
  readonly parent_id: number | null;
  readonly editor_id: number | null;
  readonly number: number;
  readonly type: "comment" | "answer";
  readonly kind: string;
  readonly content: string;
  readonly document: string;
  readonly flag_count: number;
  readonly vote_count: number;
  readonly is_endorsed: boolean;
  readonly is_anonymous: boolean;
  readonly is_private: boolean;
  readonly is_resolved: boolean;
  readonly created_at: string;
  readonly updated_at: string | null;
  readonly deleted_at: string | null;
  readonly anonymous_id: number;
  readonly vote: number;
  readonly comments: readonly {
    readonly id: number;
    readonly user_id: number;
    readonly course_id: number;
    readonly thread_id: number;
    readonly parent_id: number | null;
    readonly editor_id: number | null;
    readonly number: number;
    readonly type: "comment" | "answer";
    readonly kind: string;
    readonly content: string;
    readonly document: string;
    readonly flag_count: number;
    readonly vote_count: number;
    readonly is_endorsed: boolean;
    readonly is_anonymous: boolean;
    readonly is_private: boolean;
    readonly is_resolved: boolean;
    readonly created_at: string;
    readonly updated_at: string | null;
    readonly deleted_at: string | null;
    readonly anonymous_id: number;
    readonly vote: number;
    readonly comments: readonly any[];
  }[];
}> = Schema.Struct({
  id: Schema.Number,
  user_id: Schema.Number,
  course_id: Schema.Number,
  thread_id: Schema.Number,
  parent_id: Schema.NullOr(Schema.Number),
  editor_id: Schema.NullOr(Schema.Number),
  number: Schema.Number,
  type: Schema.Literal("comment", "answer"),
  kind: Schema.String,
  content: Schema.String,
  document: Schema.String,
  flag_count: Schema.Number,
  vote_count: Schema.Number,
  is_endorsed: Schema.Boolean,
  is_anonymous: Schema.Boolean,
  is_private: Schema.Boolean,
  is_resolved: Schema.Boolean,
  created_at: Schema.String,
  updated_at: Schema.NullOr(Schema.String),
  deleted_at: Schema.NullOr(Schema.String),
  anonymous_id: Schema.Number,
  vote: Schema.Number,
  comments: Schema.Array(Schema.suspend(() => EdComment)),
});

export const Thread = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  number: Schema.Number,
  user_id: Schema.Number, // User ID = 0 is anonymous
  type: Schema.String,
  content: Schema.String,
  /*
    No Category/Subcategory is returned as empty string
  */
  document: Schema.String,
  category: Schema.String,
  subcategory: Schema.String,
  subsubcategory: Schema.String,
  star_count: Schema.Number,
  view_count: Schema.Number,
  vote_count: Schema.Number,
  is_pinned: Schema.Boolean,
  is_answered: Schema.Boolean,
  is_student_answered: Schema.Boolean,
  is_staff_answered: Schema.Boolean,
  is_anonymous: Schema.Boolean,
  user: Schema.NullOr(User),
});
export const ThreadDetail = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  number: Schema.Number,
  user_id: Schema.Number,
  type: Schema.String,
  content: Schema.String,
  document: Schema.String,
  category: Schema.String,
  subcategory: Schema.String,
  subsubcategory: Schema.String,
  star_count: Schema.Number,
  view_count: Schema.Number,
  vote_count: Schema.Number,
  is_pinned: Schema.Boolean,
  is_answered: Schema.Boolean,
  is_student_answered: Schema.Boolean,
  is_staff_answered: Schema.Boolean,
  is_anonymous: Schema.Boolean,
  comments: Schema.Array(EdComment),
});

export const ThreadDetailResponse = Schema.Struct({
  thread: ThreadDetail,
  users: Schema.Array(User),
});

const Role = Schema.Struct({
  user_id: Schema.Number,
  course_id: Schema.Number,
  role: Schema.Literal("student", "mentor", "tutor", "staff", "admin"),
});

export const UserResponse = Schema.Struct({
  courses: Schema.Array(
    Schema.Struct({
      course: Course,
      role: Role,
      last_active: Schema.String,
    }),
  ),
  push_key: Schema.String,
});

export const ThreadResponse = Schema.Struct({
  threads: Schema.Array(Thread),
  users: Schema.Array(User),
});
