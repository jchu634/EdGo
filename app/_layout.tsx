import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import { Suspense } from "react";
import { Stack, useGlobalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { KeyProvider } from "@/src/providers/keyProvider";
import { DbProvider } from "@/src/providers/dbProvider";
import { ModalProvider, useSearchModal } from "@/src/providers/modalProvider";
import { NotificationProvider } from "@/src/providers/notificationProvider";
import { NetworkProvider } from "@/src/providers/networkProvider";
import OfflineBanner from "@/src/components/OfflineBanner";

import "@/app/global.css";

function HeaderRight() {
  const router = useRouter();
  const { courseid } = useGlobalSearchParams();
  const { openSearch } = useSearchModal();

  const normalizedCourseId =
    courseid && (!Array.isArray(courseid) || courseid.length > 0)
      ? Number(Array.isArray(courseid) ? courseid[0] : courseid)
      : NaN;
  const isInCourse = !isNaN(normalizedCourseId);

  return (
    <>
      {isInCourse && (
        <Pressable
          onPress={() => openSearch(normalizedCourseId)}
          style={{ marginRight: 16 }}
        >
          <Ionicons name="search" size={24} color="white" />
        </Pressable>
      )}
      <Pressable onPress={() => router.navigate("/settings")}>
        <Ionicons name="person" size={24} color="white" />
      </Pressable>
    </>
  );
}

export default function RootLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      <KeyProvider>
        <DbProvider>
          <NotificationProvider>
            <NetworkProvider>
              <ModalProvider>
                <View style={{ flex: 1 }}>
                  <OfflineBanner />
                  <Stack
                    screenOptions={{
                      headerStyle: {
                        backgroundColor: "#70069e",
                      },
                      headerTintColor: "white",
                      headerTitle: "",
                      headerRight: () => <HeaderRight />,
                      contentStyle: {
                        paddingBottom:
                          Platform.OS === "android" ? insets.bottom : 0,
                      },
                    }}
                  />
                </View>
              </ModalProvider>
            </NetworkProvider>
          </NotificationProvider>
        </DbProvider>
      </KeyProvider>
    </Suspense>
  );
}
