import { Schema } from "effect";

export const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  avatar: Schema.NullOr(Schema.String),
  course_role: Schema.Literal("admin", "student"),
});

export const Course = Schema.Struct({
  id: Schema.Number,
  code: Schema.String,
  name: Schema.String,
  year: Schema.Number,
  session: Schema.Number,
  settings: Schema.Struct({
    discussion: Schema.Struct({
      sortable_feed: Schema.Boolean,
      default_feed_sort_order: Schema.String,
      thread_numbers: Schema.Boolean,
      readonly: Schema.Boolean,
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

export const Thread = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  number: Schema.Number,
  user_id: Schema.Number, // User ID = 0 is anonymous
  type: Schema.Literal("post", "question", "announcement"),
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
  // TODO: Add more fields later
});

export const Comment = Schema.Struct({
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
  comments: Schema.Array(Comment),
});

export const ThreadResponse = Schema.Struct({
  threads: Schema.Array(Thread),
  users: Schema.Array(User),
});
