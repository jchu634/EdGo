import React, { useState, useCallback } from "react";
import { View, Text, Pressable, Switch, Platform } from "react-native";
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
import { sendTestNotification } from "@/src/lib/notifications";

import "@/app/global.css";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";
import DateTimePicker from "@expo/ui/datetimepicker";

const FREQUENCY_OPTIONS: { value: NotificationFrequency; label: string }[] = [
  { value: "hourly", label: "Every hour" },
  { value: "every_4_hours", label: "Every 4 hours" },
  { value: "daily_6pm", label: "Daily at 6pm" },
];

function hourToDate(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour === 12) return "12:00 PM";
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

export default function Index() {
  const [developerSettings, setDeveloperSettings] = useMMKVBoolean(
    "user.developer_settings",
    settings!,
  );
  const [userName] = useMMKVString("user.name", settings!);
  const [userEmail] = useMMKVString("user.email", settings!);
  const [userRegion] = useMMKVString("user.default_region", settings!);
  const { clearApiKey } = useApiKey();
  const { updateSyncSettings } = useNotificationSync();

  const [notifSettings, setNotifSettings] = useState(getNotificationSettings);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleNotificationChange = useCallback(
    async <K extends keyof typeof notifSettings>(
      key: K,
      value: (typeof notifSettings)[K],
    ) => {
      setNotificationSetting(key, value);
      setNotifSettings((prev) => ({ ...prev, [key]: value }));
      await updateSyncSettings();
    },
    [updateSyncSettings],
  );

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
            thumbColor={notifSettings.enabled ? "#f5dd4b" : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={(v) => handleNotificationChange("enabled", v)}
            value={notifSettings.enabled}
          />
        </View>

        {notifSettings.enabled && (
          <>
            <View className="gap-y-1.5">
              <Text className="font-display-semibold">Sync frequency</Text>
              <View className="flex flex-row gap-x-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    className={`rounded-lg px-3 py-1.5 ${
                      notifSettings.frequency === opt.value
                        ? "bg-blue-800"
                        : "bg-gray-300"
                    }`}
                    onPress={() =>
                      handleNotificationChange("frequency", opt.value)
                    }
                  >
                    <Text
                      className={`font-display text-xs ${
                        notifSettings.frequency === opt.value
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
                    notifSettings.sleepHoursEnabled ? "#f5dd4b" : "#f4f3f4"
                  }
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={(v) =>
                    handleNotificationChange("sleepHoursEnabled", v)
                  }
                  value={notifSettings.sleepHoursEnabled}
                />
              </View>
              <Text className="font-display text-xs text-gray-500">
                Mute notifications during sleep hours
              </Text>
            </View>

            {notifSettings.sleepHoursEnabled && (
              <View
                className={
                  Platform.OS === "android"
                    ? "flex flex-row gap-x-4 pl-2"
                    : "flex gap-y-2 pl-2"
                }
              >
                <View
                  className={
                    Platform.OS === "android" ? "flex-1 gap-y-1" : "gap-y-1"
                  }
                >
                  <Text className="font-display text-sm text-gray-600">
                    From:
                  </Text>
                  <Pressable
                    className="w-30 rounded-md bg-gray-200 px-3 py-1.5"
                    onPress={() => setShowStartPicker((v) => !v)}
                  >
                    <Text className="font-display w-full text-center text-sm">
                      {formatHour(notifSettings.sleepHoursStart)}
                    </Text>
                  </Pressable>
                  {showStartPicker && (
                    <DateTimePicker
                      mode="time"
                      value={hourToDate(notifSettings.sleepHoursStart)}
                      onValueChange={(_event, date) => {
                        setShowStartPicker(false);
                        if (date) {
                          handleNotificationChange(
                            "sleepHoursStart",
                            date.getHours(),
                          );
                        }
                      }}
                      onDismiss={() => setShowStartPicker(false)}
                      is24Hour={false}
                    />
                  )}
                </View>
                <View
                  className={
                    Platform.OS === "android" ? "flex-1 gap-y-1" : "gap-y-1"
                  }
                >
                  <Text className="font-display text-sm text-gray-600">
                    To:
                  </Text>
                  <Pressable
                    className="w-30 rounded-md bg-gray-200 px-3 py-1.5"
                    onPress={() => setShowEndPicker((v) => !v)}
                  >
                    <Text className="font-display w-full text-center text-sm">
                      {formatHour(notifSettings.sleepHoursEnd)}
                    </Text>
                  </Pressable>
                  {showEndPicker && (
                    <DateTimePicker
                      mode="time"
                      value={hourToDate(notifSettings.sleepHoursEnd)}
                      onValueChange={(_event, date) => {
                        setShowEndPicker(false);
                        if (date) {
                          handleNotificationChange(
                            "sleepHoursEnd",
                            date.getHours(),
                          );
                        }
                      }}
                      onDismiss={() => setShowEndPicker(false)}
                      is24Hour={false}
                    />
                  )}
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
              className="w-50 rounded-lg bg-green-100 px-3 py-1.5"
              onPress={sendTestNotification}
            >
              <Text className="font-display w-full text-center text-xs text-green-700">
                Send Test Notification
              </Text>
            </Pressable>
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
