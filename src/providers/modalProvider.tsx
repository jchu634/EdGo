import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Effect, Fiber } from "effect";

import { useDb } from "@/src/providers/dbProvider";
import { threadsTable, type ThreadUser } from "@/src/db/schema";
import { searchAndSyncThreads } from "@/src/lib/threads";
import { escapeLike } from "@/src/lib/utils";

interface LinkTextContextValue {
  openLink: (url: string) => void;
  showMenu: (url: string) => void;
}

const LinkTextContext = createContext<LinkTextContextValue>({
  openLink: () => {},
  showMenu: () => {},
});

export function useLinkTextContext() {
  return useContext(LinkTextContext);
}

interface SearchModalContextValue {
  openSearch: (courseId: number) => void;
}

const SearchModalContext = createContext<SearchModalContextValue>({
  openSearch: () => {},
});

export function useSearchModal() {
  return useContext(SearchModalContext);
}

interface SearchQueryContextValue {
  searchQuery: string | null;
  searchCourseId: number | null;
  searchSort: string;
  setSearchQuery: (courseId: number, q: string | null, sort?: string) => void;
  clearSearch: () => void;
}

const SearchQueryContext = createContext<SearchQueryContextValue>({
  searchQuery: null,
  searchCourseId: null,
  searchSort: "relevance",
  setSearchQuery: () => {},
  clearSearch: () => {},
});

export function useSearchQuery() {
  return useContext(SearchQueryContext);
}

function SearchModal({
  courseId,
  onClose,
}: {
  courseId: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const db = useDb();
  const {
    searchQuery: contextQuery,
    searchCourseId: contextCourseId,
    searchSort: contextSort,
    setSearchQuery: setContextQuery,
  } = useSearchQuery();
  const [query, setQuery] = useState(
    contextCourseId === courseId ? (contextQuery ?? "") : "",
  );
  const [sort, setSort] = useState(contextSort ?? "relevance");

  const sortTypes = ["relevance", "newest", "oldest"];

  const orderByClause =
    sort === "oldest"
      ? [desc(threadsTable.isPinned), asc(threadsTable.id)]
      : [desc(threadsTable.isPinned), desc(threadsTable.id)];

  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const fiberRef = useRef<Fiber.Fiber<any, any> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerApiSearch(searchQuery: string, sortOverride?: string) {
    const effectiveSort = sortOverride ?? sort;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (fiberRef.current) {
      Effect.runFork(Fiber.interrupt(fiberRef.current));
      fiberRef.current = null;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) {
      setIsSearchingApi(false);
      return;
    }

    setIsSearchingApi(true);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;

      const program = searchAndSyncThreads(db, courseId, trimmed, {
        sort: effectiveSort,
      }).pipe(
        Effect.tapError((err) =>
          Effect.sync(() => {
            console.error("Search failed:", err);
          }),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            setIsSearchingApi(false);
          }),
        ),
      );
      fiberRef.current = Effect.runFork(program);
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fiberRef.current) Effect.runFork(Fiber.interrupt(fiberRef.current));
    };
  }, []);

  const { data: localResults } = useLiveQuery(
    query.trim().length > 0
      ? db
          .select()
          .from(threadsTable)
          .where(
            and(
              eq(threadsTable.courseId, courseId),
              sql`${threadsTable.title} LIKE ${"%" + escapeLike(query.trim()) + "%"} ESCAPE '\\'`,
            ),
          )
          .orderBy(...orderByClause)
          .limit(50)
      : db
          .select()
          .from(threadsTable)
          .where(eq(threadsTable.courseId, courseId))
          .orderBy(...orderByClause)
          .limit(50),
    [courseId, query, sort],
  );

  const results = localResults ?? [];

  function handlePressThread(thread: ThreadUser) {
    onClose();
    router.push(`/courses/${courseId}/${thread.number}`);
  }

  function handlePersistSearch() {
    if (query.trim()) {
      setContextQuery(courseId, query.trim(), sort);
    }
    onClose();
  }

  function renderThread({ item }: { item: ThreadUser }) {
    return (
      <Pressable
        onPress={() => handlePressThread(item)}
        className="border-b border-gray-100 px-4 py-3 active:bg-gray-50 dark:border-neutral-700 dark:active:bg-neutral-800"
      >
        <Text
          className="font-display text-sm text-gray-800 dark:text-slate-100"
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text className="font-display text-xs text-gray-500">
          #{item.number}
        </Text>
      </Pressable>
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full bg-white dark:bg-slate-950"
          style={{
            maxHeight: "85%",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingTop: 8,
          }}
        >
          {/* Drag handle */}
          <View className="mb-2 h-1 w-10 self-center rounded-sm bg-gray-300 dark:bg-neutral-600" />

          {/* Search input */}
          <View
            style={{ paddingHorizontal: 16, paddingBottom: 8 }}
            className="flex-row items-center gap-x-2"
          >
            <TextInput
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                triggerApiSearch(text);
              }}
              placeholder="Search threads..."
              placeholderTextColor="#9ca3af"
              className="font-display flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-100"
              autoFocus
              returnKeyType="search"
              clearButtonMode="while-editing"
              onSubmitEditing={handlePersistSearch}
            />
            {isSearchingApi ? (
              <ActivityIndicator size="small" color="#70069e" />
            ) : query.trim().length > 0 ? (
              <Pressable onPress={handlePersistSearch}>
                <Ionicons name="arrow-forward" size={22} color="#70069e" />
              </Pressable>
            ) : null}
          </View>
          <View
            style={{ paddingHorizontal: 16, paddingBottom: 8 }}
            className="flex-row items-center gap-x-2"
          >
            <Text className="font-display-bold dark:text-slate-100">
              Sort By:{" "}
            </Text>
            {sortTypes.map((s) => (
              <Pressable
                key={s}
                className={`rounded-lg px-2 ${
                  sort === s
                    ? "border border-black dark:border-neutral-50"
                    : "bg-gray-200 dark:bg-neutral-700"
                }`}
                onPress={() => {
                  setSort(s);
                  if (query.trim().length > 0) triggerApiSearch(query, s);
                }}
              >
                <Text className="font-display dark:text-slate-100">
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Results list */}
          {results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderThread}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          ) : (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <Text className="font-display text-sm text-gray-400 dark:text-neutral-500">
                {query.trim().length > 0
                  ? isSearchingApi
                    ? "Searching..."
                    : "No matching threads found"
                  : "Start typing to search threads"}
              </Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ModalProvider — single provider for both link-text modal & search modal
// ---------------------------------------------------------------------------

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();

  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchCourseId, setSearchCourseId] = useState<number | null>(null);

  const [searchQuery, setSearchQueryState] = useState<string | null>(null);
  const [searchQueryCourseId, setSearchQueryCourseId] = useState<number | null>(
    null,
  );
  const [searchSort, setSearchSort] = useState<string>("relevance");

  function setSearchQuery(courseId: number, q: string | null, sort?: string) {
    setSearchQueryState(q);
    setSearchQueryCourseId(q ? courseId : null);
    if (sort) setSearchSort(sort);
  }

  function clearSearch() {
    setSearchQueryState(null);
    setSearchQueryCourseId(null);
  }

  async function openExternalUrl(url: string) {
    const trimmed = url.trim().toLowerCase();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://"))
      return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.error("Failed to open URL:", err);
    }
  }

  function showMenu(url: string) {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
    setActiveHref(url);
    setCopied(false);
  }

  function dismissMenu() {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
    setActiveHref(null);
    setCopied(false);
  }

  async function handleCopy() {
    if (!activeHref) return;
    await Clipboard.setStringAsync(activeHref);
    setCopied(true);
    copyTimeoutRef.current = setTimeout(() => {
      setActiveHref(null);
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 800);
  }

  function handleOpen() {
    if (!activeHref) return;
    const url = activeHref;
    setActiveHref(null);
    openExternalUrl(url);
  }

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  function openSearch(courseId: number) {
    setSearchCourseId(courseId);
  }

  function closeSearch() {
    setSearchCourseId(null);
  }

  return (
    <LinkTextContext.Provider value={{ openLink: openExternalUrl, showMenu }}>
      <SearchModalContext.Provider value={{ openSearch }}>
        <SearchQueryContext.Provider
          value={{
            searchQuery,
            searchCourseId: searchQueryCourseId,
            searchSort,
            setSearchQuery,
            clearSearch,
          }}
        >
          {children}

          {/* Link-text context menu modal */}
          <Modal
            visible={activeHref !== null}
            transparent
            animationType="fade"
            statusBarTranslucent={true}
            onRequestClose={dismissMenu}
          >
            <Pressable
              onPress={dismissMenu}
              style={{
                width,
                height,
                backgroundColor: "rgba(0,0,0,0.4)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Pressable className="w-[90%] self-center rounded-xl bg-white p-4 dark:bg-slate-950">
                <Text
                  className="font-display mb-3 text-sm text-wrap text-gray-700 dark:text-neutral-300"
                  numberOfLines={2}
                  ellipsizeMode="middle"
                >
                  {activeHref}
                </Text>

                {copied ? (
                  <Text className="font-display text-center text-sm text-green-600 dark:text-green-400">
                    Copied!
                  </Text>
                ) : (
                  <View style={{ gap: 12 }}>
                    <Pressable
                      onPress={handleCopy}
                      className="w-50 items-center self-center rounded-lg bg-gray-300 py-3 active:bg-gray-200 dark:bg-neutral-700 dark:active:bg-neutral-600"
                      style={{
                        width: 200,
                        alignSelf: "center",
                      }}
                    >
                      <Text className="font-display text-md text-center text-gray-800 dark:text-neutral-100">
                        Copy Link
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleOpen}
                      className="w-50 items-center self-center rounded-lg bg-gray-300 py-3 active:bg-gray-200 dark:bg-neutral-700 dark:active:bg-neutral-600"
                      style={{
                        width: 200,
                        alignSelf: "center",
                      }}
                    >
                      <Text className="font-display text-md text-center text-gray-800 dark:text-neutral-100">
                        Open Link
                      </Text>
                    </Pressable>
                  </View>
                )}
              </Pressable>
            </Pressable>
          </Modal>

          {/* Search modal — only mounted when active */}
          {searchCourseId !== null && (
            <SearchModal courseId={searchCourseId} onClose={closeSearch} />
          )}
        </SearchQueryContext.Provider>
      </SearchModalContext.Provider>
    </LinkTextContext.Provider>
  );
}
