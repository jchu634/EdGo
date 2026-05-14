import React from "react";
import { View, Text, Pressable } from "react-native";
import { clearCourseCache, clearThreadCache } from "@/src/lib/storage";
import { settings } from "@/src/lib/storage";

import "@/app/global.css";

export default function Index() {
  return (
    <View className="flex h-full p-4">
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

      <View className="absolute bottom-4 left-4 gap-y-2">
        <Pressable
          className="rounded-lg bg-red-100 px-3 py-1.5"
          onPress={() => {
            clearCourseCache();
          }}
        >
          <Text className="font-display text-xs text-red-700">
            Purge Course Cache
          </Text>
        </Pressable>
        <Pressable
          className="rounded-lg bg-red-100 px-3 py-1.5"
          onPress={() => clearThreadCache()}
        >
          <Text className="font-display text-xs text-red-700">
            Purge Thread Cache
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
