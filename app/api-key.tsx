import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Image } from "expo-image";

import { useApiKey } from "@/src/providers/keyProvider";
import { EyeClosedIcon, EyeIcon } from "phosphor-react-native";

export default function ApiKeyScreen() {
  const { setApiKey, isLoading } = useApiKey();
  const [inputKey, setInputKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(true);

  const handleSave = async () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      Alert.alert("Missing API Key", "Please enter your EdSTEM API key.");
      return;
    }

    setSaving(true);
    try {
      await setApiKey(trimmed);
      // KeyProvider will auto-redirect to "/" once apiKey is set
    } catch (error) {
      Alert.alert("Error", "Failed to save API key. Please try again.");
      console.error("Failed to save API key:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <View className="w-full max-w-md">
        <Image
          source={require("@/assets/images/icon.png")}
          contentFit="cover"
          transition={1000}
          style={{ width: 200, height: 200, alignSelf: "center" }}
        />

        <Text className="font-display-black mb-2 text-center text-5xl">
          Welcome to EdGo
        </Text>
        <Text className="font-display-medium mb-2 text-center text-black">
          Enter your EdSTEM API key to get started. {"\n"}
          You can find your API key at this link below.
        </Text>
        <Text
          className="mb-8 text-center font-mono text-lg text-blue-500"
          onPress={() =>
            Linking.openURL("https://edstem.org/us/settings/api-tokens")
          }
        >
          https://edstem.org/us/settings/api-tokens
        </Text>

        <View className="relative mb-4 flex flex-row items-center gap-x-4">
          <TextInput
            className="w-full rounded-xl border border-gray-300 p-4 font-mono text-base"
            placeholder="Enter your API key here"
            value={inputKey}
            onChangeText={setInputKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={showKey}
            editable={!saving && !isLoading}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <TouchableOpacity
            onPress={() => setShowKey(!showKey)}
            className="absolute right-3 size-12 items-center justify-center rounded-lg"
          >
            {showKey ? <EyeClosedIcon /> : <EyeIcon />}
          </TouchableOpacity>
        </View>

        <Pressable
          className={`items-center rounded-xl p-4 ${
            saving || isLoading
              ? "bg-blue-400"
              : "bg-[#71059f] active:bg-blue-700"
          }`}
          onPress={handleSave}
          disabled={saving || isLoading}
        >
          <Text className="font-display-semibold text-lg text-white">
            {saving ? "Saving..." : "Continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
