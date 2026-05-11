import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  useWindowDimensions,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";

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

export function LinkTextProvider({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

  return (
    <LinkTextContext.Provider value={{ openLink, showMenu }}>
      {children}
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
    </LinkTextContext.Provider>
  );
}

interface LinkTextProps {
  href: string;
  children: React.ReactNode;
}

export default function LinkText({ href, children }: LinkTextProps) {
  const { openLink, showMenu } = useLinkTextContext();

  /*
   * href is currently bugged as somehow href is passed as a child instead of a node attr, hence temp workaround with children as string
   */
  return (
    <Text
      className="text-blue-700 underline"
      onPress={() => openLink(children as string)}
      onLongPress={() => showMenu(children as string)}
      selectable={false}
    >
      {children}
    </Text>
  );
}
