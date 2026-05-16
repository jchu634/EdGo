import React from "react";
import { View, Text, Pressable, Switch } from "react-native";
import {
  clearCourseCache,
  clearThreadCache,
  settings,
  getNotificationSettings,
  setNotificationSetting,
  type NotificationFrequency,
} from "@/src/lib/storage";
import { useApiKey } from "@/src/providers/keyProvider";
import { useNotificationSync } from "@/src/providers/notificationProvider";

import "@/app/global.css";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";

const FREQUENCY_OPTIONS: { value: NotificationFrequency; label: string }[] = [
  { value: "hourly", label: "Every hour" },
  { value: "every_4_hours", label: "Every 4 hours" },
  { value: "daily_6pm", label: "Daily at 6pm" },
];

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const HOUR_LABELS: Record<number, string> = Object.fromEntries(
  HOURS_24.map((h) => {
    if (h === 0) return [h, "12:00 AM"];
    if (h === 12) return [h, "12:00 PM"];
    if (h < 12) return [h, `${h}:00 AM`];
    return [h, `${h - 12}:00 PM`];
  }),
);

export default function Index() {
  const [developerSettings, setDeveloperSettings] = useMMKVBoolean(
    "user.developer_settings",
    settings,
  );
  const [userName] = useMMKVString("user.name", settings);
  const [userEmail] = useMMKVString("user.email", settings);
  const [userRegion] = useMMKVString("user.default_region", settings);
  const { clearApiKey } = useApiKey();
  const { updateSyncSettings } = useNotificationSync();

  const notificationSettings = getNotificationSettings();

  const handleNotificationChange = async <
    K extends keyof ReturnType<typeof getNotificationSettings>,
  >(
    key: K,
    value: ReturnType<typeof getNotificationSettings>[K],
  ) => {
    setNotificationSetting(key, value);
    await updateSyncSettings();
  };

  return (
    <View className="flex h-full gap-y-8 p-4">
      <View>
        <Text className="font-display-bold text-2xl">User Details</Text>
        <Text className="font-display">Name: {userName ?? "Loading..."}</Text>
        <Text className="font-display">Email: {userEmail ?? "Loading..."}</Text>
        <Text className="font-display">
          Region: {userRegion ?? "Loading..."}
        </Text>
      </View>
      <View>
        <Pressable
          className="w-30 rounded-lg bg-blue-800 px-3 py-1.5"
          onPress={async () => {
            try {
              await clearApiKey();
            } catch (e) {
              console.error("Error clearing API key:", e);
            }
          }}
        >
          <Text className="font-display w-full text-center text-xs text-white">
            Logout
          </Text>
        </Pressable>
      </View>

      <View className="gap-y-3">
        <Text className="font-display-bold text-2xl">Notifications</Text>

        <View className="flex flex-row items-center justify-between">
          <Text className="font-display">Enable notifications</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={notificationSettings.enabled ? "#f5dd4b" : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={(v) => handleNotificationChange("enabled", v)}
            value={notificationSettings.enabled}
          />
        </View>

        {notificationSettings.enabled && (
          <>
            <View className="gap-y-1.5">
              <Text className="font-display-semibold">Sync frequency</Text>
              <View className="flex flex-row gap-x-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    className={`rounded-lg px-3 py-1.5 ${
                      notificationSettings.frequency === opt.value
                        ? "bg-blue-800"
                        : "bg-gray-300"
                    }`}
                    onPress={() =>
                      handleNotificationChange("frequency", opt.value)
                    }
                  >
                    <Text
                      className={`font-display text-xs ${
                        notificationSettings.frequency === opt.value
                          ? "text-white"
                          : "text-black"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="gap-y-1.5">
              <View className="flex flex-row items-center justify-between">
                <Text className="font-display-semibold">Sleep hours</Text>
                <Switch
                  trackColor={{ false: "#767577", true: "#81b0ff" }}
                  thumbColor={
                    notificationSettings.sleepHoursEnabled
                      ? "#f5dd4b"
                      : "#f4f3f4"
                  }
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={(v) =>
                    handleNotificationChange("sleepHoursEnabled", v)
                  }
                  value={notificationSettings.sleepHoursEnabled}
                />
              </View>
              <Text className="font-display text-xs text-gray-500">
                Mute notifications during sleep hours
              </Text>
            </View>

            {notificationSettings.sleepHoursEnabled && (
              <View className="gap-y-2 pl-2">
                <View className="flex flex-row items-center gap-x-2">
                  <Text className="font-display text-sm text-gray-600">
                    From:
                  </Text>
                  <Pressable
                    className="rounded-md bg-gray-200 px-2 py-1"
                    onPress={() => {
                      const next =
                        (notificationSettings.sleepHoursStart + 23) % 24;
                      handleNotificationChange("sleepHoursStart", next);
                    }}
                  >
                    <Text className="font-display text-sm">
                      {HOUR_LABELS[notificationSettings.sleepHoursStart]}
                    </Text>
                  </Pressable>
                </View>
                <View className="flex flex-row items-center gap-x-2">
                  <Text className="font-display text-sm text-gray-600">
                    To:
                  </Text>
                  <Pressable
                    className="rounded-md bg-gray-200 px-2 py-1"
                    onPress={() => {
                      const next =
                        (notificationSettings.sleepHoursEnd + 23) % 24;
                      handleNotificationChange("sleepHoursEnd", next);
                    }}
                  >
                    <Text className="font-display text-sm">
                      {HOUR_LABELS[notificationSettings.sleepHoursEnd]}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      <View>
        <View className="flex flex-row">
          <Text className="font-display-bold text-2xl">Developer Settings</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={developerSettings ? "#f5dd4b" : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={() => setDeveloperSettings(!developerSettings)}
            value={developerSettings}
          />
        </View>

        {developerSettings && (
          <View className="flex w-full flex-col gap-y-2">
            <Pressable
              className="w-50 rounded-lg bg-red-100 px-3 py-1.5"
              onPress={() => {
                clearCourseCache();
              }}
            >
              <Text className="font-display w-full text-center text-xs text-red-700">
                Purge Course Cache
              </Text>
            </Pressable>
            <Pressable
              className="w-50 rounded-lg bg-red-100 px-3 py-1.5"
              onPress={() => clearThreadCache()}
            >
              <Text className="font-display w-full text-center text-xs text-red-700">
                Purge Thread Cache
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
