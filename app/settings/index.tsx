import React from "react";
import { View, Text, Pressable, Switch } from "react-native";
import { clearCourseCache, clearThreadCache } from "@/src/lib/storage";
import { settings } from "@/src/lib/storage";

import "@/app/global.css";
import { useMMKVBoolean } from "react-native-mmkv";

export default function Index() {
  const [developerSettings, setDeveloperSettings] = useMMKVBoolean(
    "user.developer_settings",
    settings,
  );
  return (
    <View className="flex h-full gap-y-8 p-4">
      <View>
        <Text className="font-display-bold text-2xl">User Details</Text>
        <Text className="font-display">
          Name: {settings.getString("user.name")}
        </Text>
        <Text className="font-display">
          Email: {settings.getString("user.email")}
        </Text>
        <Text className="font-display">
          Region: {settings.getString("user.default_region")}
        </Text>
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
