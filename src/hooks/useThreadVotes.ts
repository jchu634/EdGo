import { useState } from "react";
import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { threadsTable } from "@/src/db/schema";
import type { Db } from "@/src/providers/dbProvider";
import type { ThreadDetail } from "@/src/lib/thread-detail";
import {
  starThread,
  unstarThread,
  upvoteThread,
  unvoteThread,
  upvoteComment,
  unvoteComment,
} from "@/src/lib/threads";

export interface VoteState {
  isStarred: boolean;
  starCount: number;
  isVoted: boolean;
  voteCount: number;
  commentVotes: Map<number, boolean>;
  commentVoteCounts: Map<number, number>;
}

type NestedComment = ThreadDetail["comments"][number];

function buildVoteState(thread: ThreadDetail): VoteState {
  const commentVotes = new Map<number, boolean>();
  const commentVoteCounts = new Map<number, number>();
  const walk = (comments: readonly NestedComment[]) => {
    for (const c of comments) {
      commentVotes.set(c.id, c.vote === 1);
      commentVoteCounts.set(c.id, c.vote_count);
      if (c.comments.length > 0) walk(c.comments);
    }
  };
  walk(thread.comments);
  walk(thread.answers);
  return {
    isStarred: thread.is_starred,
    starCount: thread.star_count,
    isVoted: (thread.vote ?? 0) === 1,
    voteCount: thread.vote_count,
    commentVotes,
    commentVoteCounts,
  };
}

const EMPTY_VOTE_STATE: VoteState = {
  isStarred: false,
  starCount: 0,
  isVoted: false,
  voteCount: 0,
  commentVotes: new Map(),
  commentVoteCounts: new Map(),
};

export function useThreadVotes(thread: ThreadDetail | null, db: Db) {
  const [state, setState] = useState<VoteState>(EMPTY_VOTE_STATE);
  const [trackedThreadId, setTrackedThreadId] = useState<number | null>(null);

  const currentId = thread?.id ?? null;
  if (currentId !== trackedThreadId) {
    setTrackedThreadId(currentId);
    setState(thread ? buildVoteState(thread) : EMPTY_VOTE_STATE);
  }

  function toggleStar() {
    if (!thread) return;
    const next = !state.isStarred;
    const prevStarred = state.isStarred;
    const prevCount = state.starCount;
    setState((s) => ({
      ...s,
      isStarred: next,
      starCount: s.starCount + (next ? 1 : -1),
    }));
    const program = Effect.gen(function* () {
      yield* (next ? starThread : unstarThread)(thread.id);
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(threadsTable)
            .set({
              isStarred: next,
              starCount: next ? prevCount + 1 : prevCount - 1,
            })
            .where(eq(threadsTable.id, thread.id)),
        catch: (e) => new Error(`DB star update failed: ${String(e)}`),
      });
    }).pipe(
      Effect.tapError((err) =>
        Effect.sync(() => {
          console.error(
            `[Star] failed to ${next ? "star" : "unstar"} ${thread.id}:`,
            err,
          );
          setState((s) => ({ ...s, isStarred: prevStarred, starCount: prevCount }));
        }),
      ),
      Effect.ignore,
    );
    Effect.runFork(program);
  }

  function toggleVote() {
    if (!thread) return;
    const next = !state.isVoted;
    const prevVoted = state.isVoted;
    const prevCount = state.voteCount;
    setState((s) => ({
      ...s,
      isVoted: next,
      voteCount: s.voteCount + (next ? 1 : -1),
    }));
    const program = Effect.gen(function* () {
      yield* (next ? upvoteThread : unvoteThread)(thread.id);
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(threadsTable)
            .set({
              isVoted: next,
              voteCount: next ? prevCount + 1 : prevCount - 1,
            })
            .where(eq(threadsTable.id, thread.id)),
        catch: (e) => new Error(`DB vote update failed: ${String(e)}`),
      });
    }).pipe(
      Effect.tapError((err) =>
        Effect.sync(() => {
          console.error(
            `[Vote] failed to ${next ? "upvote" : "unvote"} ${thread.id}:`,
            err,
          );
          setState((s) => ({ ...s, isVoted: prevVoted, voteCount: prevCount }));
        }),
      ),
      Effect.ignore,
    );
    Effect.runFork(program);
  }

  function toggleCommentVote(commentId: number, currentVoted: boolean) {
    const next = !currentVoted;
    setState((s) => {
      const commentVotes = new Map(s.commentVotes);
      commentVotes.set(commentId, next);
      const commentVoteCounts = new Map(s.commentVoteCounts);
      commentVoteCounts.set(
        commentId,
        (commentVoteCounts.get(commentId) ?? 0) + (next ? 1 : -1),
      );
      return { ...s, commentVotes, commentVoteCounts };
    });
    const program = (next ? upvoteComment : unvoteComment)(commentId).pipe(
      Effect.tapError((err) =>
        Effect.sync(() => {
          console.error(
            `[Vote] failed to ${next ? "upvote" : "unvote"} comment ${commentId}:`,
            err,
          );
          setState((s) => {
            const commentVotes = new Map(s.commentVotes);
            commentVotes.set(commentId, !next);
            const commentVoteCounts = new Map(s.commentVoteCounts);
            commentVoteCounts.set(
              commentId,
              (commentVoteCounts.get(commentId) ?? 0) + (next ? -1 : 1),
            );
            return { ...s, commentVotes, commentVoteCounts };
          });
        }),
      ),
      Effect.ignore,
    );
    Effect.runFork(program);
  }

  return {
    isStarred: state.isStarred,
    starCount: state.starCount,
    isVoted: state.isVoted,
    voteCount: state.voteCount,
    commentVotes: state.commentVotes,
    commentVoteCounts: state.commentVoteCounts,
    toggleStar,
    toggleVote,
    toggleCommentVote,
  };
}
