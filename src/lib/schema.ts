import { Schema } from "effect";

const _baseUser = Schema.Struct({
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

export const UserResponseUser = Schema.Struct({
  ..._baseUser.fields,
  email: Schema.String,
  username: Schema.NullOr(Schema.String),
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

const edCommentFields = {
  id: Schema.Number,
  user_id: Schema.Number,
  course_id: Schema.Number,
  thread_id: Schema.Number,
  original_id: Schema.NullOr(Schema.Number),
  parent_id: Schema.NullOr(Schema.Number),
  editor_id: Schema.NullOr(Schema.Number),
  number: Schema.Number,
  type: Schema.Literals(["comment", "answer"]),
  kind: Schema.String,
  content: Schema.String,
  document: Schema.String,
  flag_count: Schema.Number,
  vote_count: Schema.Number,
  is_endorsed: Schema.Boolean,
  is_anonymous: Schema.Boolean,
  is_private: Schema.Boolean,
  is_resolved: Schema.Boolean,
  created_by_bot_id: Schema.NullOr(Schema.Number),
  created_at: Schema.String,
  updated_at: Schema.NullOr(Schema.String),
  deleted_at: Schema.NullOr(Schema.String),
  anonymous_id: Schema.NullOr(Schema.Number),
  vote: Schema.NullOr(Schema.Number),
};

interface EdComment extends Schema.Struct.Type<typeof edCommentFields> {
  readonly comments: ReadonlyArray<EdComment>;
}

const EdComment = Schema.Struct({
  ...edCommentFields,
  comments: Schema.Array(
    Schema.suspend((): Schema.Schema<EdComment> => EdComment),
  ),
});

export { EdComment };

const Thread = Schema.Struct({
  id: Schema.Number,
  user_id: Schema.Number, // User ID = 0 is anonymous
  number: Schema.Number,
  type: Schema.String,
  title: Schema.String,
  content: Schema.String,
  document: Schema.String,
  /*
    No Category/Subcategory is returned as empty string
  */
  category: Schema.String,
  subcategory: Schema.String,
  subsubcategory: Schema.String,

  star_count: Schema.Number,
  view_count: Schema.Number,
  unique_view_count: Schema.Number,
  vote_count: Schema.Number,
  reply_count: Schema.Number,

  is_pinned: Schema.Boolean,
  is_answered: Schema.Boolean,
  is_student_answered: Schema.Boolean,
  is_staff_answered: Schema.Boolean,
  is_anonymous: Schema.Boolean,
  created_at: Schema.String,
  updated_at: Schema.NullOr(Schema.String),
});

export const ThreadUser = Schema.Struct({
  ...Thread.fields,
  user: Schema.NullOr(_baseUser),
});

export const ThreadDetail = Schema.Struct({
  ...Thread.fields,
  comments: Schema.Array(EdComment),
  answers: Schema.Array(EdComment),
});

export const ThreadDetailResponse = Schema.Struct({
  thread: ThreadDetail,
  users: Schema.Array(_baseUser),
});

const Role = Schema.Struct({
  user_id: Schema.Number,
  course_id: Schema.Number,
  role: Schema.Literals(["student", "mentor", "tutor", "staff", "admin"]),
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
  user: UserResponseUser,
});

export const ThreadResponse = Schema.Struct({
  threads: Schema.Array(Thread),
  users: Schema.Array(_baseUser),
});

export const RegionResponse = Schema.Struct({
  country_code: Schema.String,
  default_region: Schema.String,
});
