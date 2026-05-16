import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "expo-router";
import {
  registerBackgroundSyncTask,
  unregisterBackgroundSyncTask,
} from "@/src/lib/backgroundSync";
import { addNotificationResponseListener } from "@/src/lib/notifications";
import { useApiKey } from "@/src/providers/keyProvider";

interface NotificationContextType {
  updateSyncSettings: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  updateSyncSettings: async () => {},
});

export function useNotificationSync() {
  return useContext(NotificationContext);
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { apiKey } = useApiKey();

  const updateSyncSettings = useCallback(async () => {
    if (apiKey) {
      await registerBackgroundSyncTask();
    } else {
      await unregisterBackgroundSyncTask();
    }
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) {
      registerBackgroundSyncTask();
    }
    return () => {
      unregisterBackgroundSyncTask();
    };
  }, [apiKey]);

  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const courseId = response.notification.request.content.data?.courseId;
      if (typeof courseId === "number") {
        router.navigate(`/courses/${courseId}`);
      }
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <NotificationContext.Provider value={{ updateSyncSettings }}>
      {children}
    </NotificationContext.Provider>
  );
}
