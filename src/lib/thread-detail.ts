import { Effect, Schema } from "effect";
import { parseXml } from "react-native-turboxml";
import { XmlNode, isXmlNode } from "@/src/lib/renderXML";
import { ThreadDetailResponse } from "@/src/lib/schema";
import { fetchThreadDetail } from "@/src/lib/threads";
import {
  getCachedThreadDetail,
  cacheThreadDetail,
  getCachedParsedXml,
  cacheParsedXml,
} from "@/src/lib/storage";

type ThreadDetailResponseT = Schema.Schema.Type<typeof ThreadDetailResponse>;

export type ThreadDetail = ThreadDetailResponseT["thread"];

export interface UsersMapValue {
  name: string;
  avatar: string | null;
}
export type UsersMap = Map<number, UsersMapValue>;

export interface ThreadDetailData {
  thread: ThreadDetail;
  usersMap: UsersMap;
  parsedXmlMap: Map<string, XmlNode>;
}

type NestedComment = ThreadDetail["comments"][number];

export function buildUsersMap(users: ThreadDetailResponseT["users"]): UsersMap {
  const map: UsersMap = new Map();
  for (const u of users) {
    map.set(u.id, { name: u.name, avatar: u.avatar });
  }
  return map;
}

function flattenComments(comments: readonly NestedComment[]): NestedComment[] {
  const out: NestedComment[] = [];
  for (const c of comments) {
    out.push(c);
    if (c.comments.length > 0) out.push(...flattenComments(c.comments));
  }
  return out;
}

function loadCachedXmlInto(
  comments: readonly NestedComment[],
  courseId: number,
  threadNumber: number,
  out: Map<string, XmlNode>,
) {
  for (const c of comments) {
    const cached = getCachedParsedXml(courseId, threadNumber, `comment-${c.id}`);
    if (cached && isXmlNode(cached)) {
      out.set(`comment-${c.id}`, cached as XmlNode);
    }
    if (c.comments.length > 0) {
      loadCachedXmlInto(c.comments, courseId, threadNumber, out);
    }
  }
}

export function readCachedThreadDetailData(
  courseId: number,
  threadNumber: number,
): ThreadDetailData | null {
  const cached = getCachedThreadDetail(courseId, threadNumber);
  if (!cached) return null;

  const parsedXmlMap = new Map<string, XmlNode>();
  const mainCached = getCachedParsedXml(courseId, threadNumber, "main");
  if (mainCached && isXmlNode(mainCached)) {
    parsedXmlMap.set("main", mainCached as XmlNode);
  }
  loadCachedXmlInto(cached.thread.comments, courseId, threadNumber, parsedXmlMap);
  loadCachedXmlInto(cached.thread.answers, courseId, threadNumber, parsedXmlMap);

  return {
    thread: cached.thread,
    usersMap: buildUsersMap(cached.users),
    parsedXmlMap,
  };
}

function parseXmlEffect(xmlString: string): Effect.Effect<XmlNode | null> {
  return Effect.promise(async () => {
    try {
      const result = await parseXml(xmlString);
      if (isXmlNode(result)) return result as XmlNode;
      const doc = (result as Record<string, unknown>)?.document;
      if (doc && isXmlNode(doc)) return doc as XmlNode;
      return null;
    } catch (e) {
      console.warn("[XML] Failed to parse:", e);
      return null;
    }
  });
}

function parseAndCacheXmlEffect(
  xmlString: string,
  xmlKey: string,
  courseId: number,
  threadNumber: number,
): Effect.Effect<XmlNode | null> {
  return parseXmlEffect(xmlString).pipe(
    Effect.tap((node) =>
      Effect.sync(() => {
        if (node) cacheParsedXml(courseId, threadNumber, xmlKey, node);
      }),
    ),
  );
}

export function loadFreshThreadDetailData(
  courseId: number,
  threadNumber: number,
): Effect.Effect<ThreadDetailData, Error, never> {
  const program = Effect.gen(function* () {
    const response = yield* fetchThreadDetail(courseId, threadNumber);

    cacheThreadDetail(courseId, threadNumber, response);

    const targets: { key: string; content: string }[] = [];
    if (response.thread.content) {
      targets.push({ key: "main", content: response.thread.content });
    }
    for (const c of flattenComments(response.thread.comments)) {
      if (c.content) targets.push({ key: `comment-${c.id}`, content: c.content });
    }
    for (const c of flattenComments(response.thread.answers)) {
      if (c.content) targets.push({ key: `comment-${c.id}`, content: c.content });
    }

    const parsed = yield* Effect.forEach(targets, (t) =>
      parseAndCacheXmlEffect(t.content, t.key, courseId, threadNumber).pipe(
        Effect.map((node) => (node ? ({ key: t.key, node }) : null)),
      ),
    );

    const parsedXmlMap = new Map<string, XmlNode>();
    for (const p of parsed) {
      if (p) parsedXmlMap.set(p.key, p.node);
    }

    console.log(
      `[XML] Parsed ${parsedXmlMap.size}/${targets.length} XML entries`,
    );

    return {
      thread: response.thread,
      usersMap: buildUsersMap(response.users),
      parsedXmlMap,
    };
  });
  return program as Effect.Effect<ThreadDetailData, Error, never>;
}
