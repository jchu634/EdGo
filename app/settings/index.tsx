import React from "react";
import { View, Text, Pressable, Switch } from "react-native";
import { clearCourseCache, clearThreadCache } from "@/src/lib/storage";
import { settings } from "@/src/lib/storage";
import { useApiKey } from "@/src/providers/keyProvider";

import "@/app/global.css";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";

export default function Index() {
  const [developerSettings, setDeveloperSettings] = useMMKVBoolean(
    "user.developer_settings",
    settings,
  );
  const [userName] = useMMKVString("user.name", settings);
  const [userEmail] = useMMKVString("user.email", settings);
  const [userRegion] = useMMKVString("user.default_region", settings);
  const { clearApiKey } = useApiKey();

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
