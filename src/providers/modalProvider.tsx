import React, {
  createContext,
  useCallback,
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
import { Effect } from "effect";

import { useDb } from "@/src/providers/dbProvider";
import { threadsTable, type ThreadUser } from "@/src/db/schema";
import { searchThreadsFromApi, syncThreadsToDb } from "@/src/lib/threads";

function escapeLike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

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

  const orderByClause =
    sort === "oldest"
      ? [desc(threadsTable.isPinned), asc(threadsTable.id)]
      : [desc(threadsTable.isPinned), desc(threadsTable.id)];

  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local DB results — always queried, gives instant results
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

  // Debounced API search — syncs results to local DB so useLiveQuery picks them up
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length === 0) {
      setIsSearchingApi(false);
      return;
    }

    let isCurrent = true;

    setIsSearchingApi(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await Effect.runPromise(
          searchThreadsFromApi(courseId, query.trim(), { sort }),
        );
        if (!isCurrent) return;
        if (response?.threads?.length) {
          await syncThreadsToDb(db, courseId, response.threads as any[]);
        }
      } catch (err) {
        console.error("[search] API search failed:", err);
      } finally {
        if (isCurrent) {
          setIsSearchingApi(false);
        }
      }
    }, 400);

    return () => {
      isCurrent = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [courseId, query, sort, db]);

  const results = localResults ?? [];

  const handlePressThread = useCallback(
    (thread: ThreadUser) => {
      onClose();
      router.push(`/courses/${courseId}/${thread.number}`);
    },
    [courseId, onClose, router],
  );

  const handlePersistSearch = useCallback(() => {
    if (query.trim()) {
      setContextQuery(courseId, query.trim(), sort);
    }
    onClose();
  }, [query, courseId, setContextQuery, onClose, sort]);

  const renderThread = useCallback(
    ({ item }: { item: ThreadUser }) => (
      <Pressable
        onPress={() => handlePressThread(item)}
        className="border-b border-gray-100 px-4 py-3 active:bg-gray-50 dark:border-neutral-700 dark:active:bg-neutral-800"
      >
        <Text
          className="font-display text-sm text-gray-800 dark:text-neutral-100"
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text className="font-display text-xs text-gray-400">
          #{item.number}
        </Text>
      </Pressable>
    ),
    [handlePressThread],
  );

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
              onChangeText={setQuery}
              placeholder="Search threads..."
              placeholderTextColor="#9ca3af"
              className="font-display flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
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
            <Text className="font-display-bold dark:text-neutral-200">
              Sort By:{" "}
            </Text>
            <Pressable
              className={`rounded-lg px-2 ${
                sort === "relevance"
                  ? "border border-black dark:border-neutral-50"
                  : "bg-gray-200 dark:bg-neutral-700"
              }`}
              onPress={() => setSort("relevance")}
            >
              <Text className="font-display dark:text-neutral-200">
                Relevance
              </Text>
            </Pressable>
            <Pressable
              className={`rounded-lg px-2 ${
                sort === "newest"
                  ? "border border-black dark:border-neutral-50"
                  : "bg-gray-200 dark:bg-neutral-700"
              }`}
              onPress={() => setSort("newest")}
            >
              <Text className="font-display dark:text-neutral-200">Newest</Text>
            </Pressable>
            <Pressable
              className={`rounded-lg px-2 ${
                sort === "oldest"
                  ? "border border-black dark:border-neutral-50"
                  : "bg-gray-200 dark:bg-neutral-700"
              }`}
              onPress={() => setSort("oldest")}
            >
              <Text className="font-display dark:text-neutral-200">Oldest</Text>
            </Pressable>
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

  // Link-text modal state
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search modal state
  const [searchCourseId, setSearchCourseId] = useState<number | null>(null);

  // Search query state (persisted for threads page)
  const [searchQuery, setSearchQueryState] = useState<string | null>(null);
  const [searchQueryCourseId, setSearchQueryCourseId] = useState<number | null>(
    null,
  );
  const [searchSort, setSearchSort] = useState<string>("relevance");

  const setSearchQuery = useCallback(
    (courseId: number, q: string | null, sort?: string) => {
      setSearchQueryState(q);
      setSearchQueryCourseId(q ? courseId : null);
      if (sort) setSearchSort(sort);
    },
    [],
  );

  const clearSearch = useCallback(() => {
    setSearchQueryState(null);
    setSearchQueryCourseId(null);
  }, []);

  // Link-text helpers

  const openExternalUrl = useCallback(async (url: string) => {
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
  }, []);

  const openLink = useCallback(
    (url: string) => {
      openExternalUrl(url);
    },
    [openExternalUrl],
  );

  const showMenu = useCallback((url: string) => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
    setActiveHref(url);
    setCopied(false);
  }, []);

  const dismissMenu = useCallback(() => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
    setActiveHref(null);
    setCopied(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!activeHref) return;
    await Clipboard.setStringAsync(activeHref);
    setCopied(true);
    copyTimeoutRef.current = setTimeout(() => {
      setActiveHref(null);
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 800);
  }, [activeHref]);

  const handleOpen = useCallback(() => {
    if (!activeHref) return;
    const url = activeHref;
    setActiveHref(null);
    openExternalUrl(url);
  }, [activeHref, openExternalUrl]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Search modal helpers
  const openSearch = useCallback((courseId: number) => {
    setSearchCourseId(courseId);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchCourseId(null);
  }, []);

  return (
    <LinkTextContext.Provider value={{ openLink, showMenu }}>
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
