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
import { eq, and, desc, sql } from "drizzle-orm";
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
  setSearchQuery: (courseId: number, q: string | null) => void;
  clearSearch: () => void;
}

const SearchQueryContext = createContext<SearchQueryContextValue>({
  searchQuery: null,
  searchCourseId: null,
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
  const { searchQuery: contextQuery, setSearchQuery: setContextQuery } =
    useSearchQuery();
  const [query, setQuery] = useState(contextQuery ?? "");
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
          .limit(50)
      : db
          .select()
          .from(threadsTable)
          .where(eq(threadsTable.courseId, courseId))
          .orderBy(desc(threadsTable.isPinned), desc(threadsTable.id))
          .limit(50),
    [courseId, query],
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
          searchThreadsFromApi(courseId, query.trim()),
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
  }, [courseId, query, db]);

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
      setContextQuery(courseId, query.trim());
    }
    onClose();
  }, [query, courseId, setContextQuery, onClose]);

  const renderThread = useCallback(
    ({ item }: { item: ThreadUser }) => (
      <Pressable
        onPress={() => handlePressThread(item)}
        className="border-b border-gray-100 px-4 py-3 active:bg-gray-50"
      >
        <Text className="font-display text-sm text-gray-800" numberOfLines={1}>
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
          style={{
            width: "100%",
            maxHeight: "85%",
            backgroundColor: "white",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingTop: 8,
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#d1d5db",
              alignSelf: "center",
              marginBottom: 8,
            }}
          />

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
              className="font-display flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800"
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
              <Text className="font-display text-sm text-gray-400">
                {query.trim().length > 0
                  ? "No matching threads found"
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

  const setSearchQuery = useCallback((courseId: number, q: string | null) => {
    setSearchQueryState(q);
    setSearchQueryCourseId(q ? courseId : null);
  }, []);

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
              <Pressable
                style={{
                  width: "90%",
                  borderRadius: 12,
                  backgroundColor: "white",
                  padding: 16,
                  alignSelf: "center",
                }}
              >
                <Text
                  className="font-display mb-3 text-sm text-wrap text-gray-700"
                  numberOfLines={2}
                  ellipsizeMode="middle"
                >
                  {activeHref}
                </Text>

                {copied ? (
                  <Text className="font-display text-center text-sm text-green-600">
                    Copied!
                  </Text>
                ) : (
                  <View style={{ gap: 12 }}>
                    <Pressable
                      onPress={handleCopy}
                      className="items-center rounded-lg bg-gray-300 py-3 active:bg-gray-200"
                      style={{
                        width: 200,
                        alignSelf: "center",
                      }}
                    >
                      <Text className="font-display text-md text-center text-gray-800">
                        Copy Link
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleOpen}
                      className="items-center rounded-lg bg-gray-300 py-3 active:bg-gray-200"
                      style={{
                        width: 200,
                        alignSelf: "center",
                      }}
                    >
                      <Text className="font-display text-md text-center text-gray-800">
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
