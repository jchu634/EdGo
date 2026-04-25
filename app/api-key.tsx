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
    <View className="flex-1 justify-center items-center p-6 bg-white">
      <View className="w-full max-w-md">
        <Image
          source={require("@/assets/images/logo.png")}
          contentFit="cover"
          transition={1000}
          style={{ width: 200, height: 200, alignSelf: "center" }}
        />

        <Text className="text-5xl text-center mb-2 font-display-black">
          Welcome to EdGo
        </Text>
        <Text className="text-black text-center mb-2 font-display-medium">
          Enter your EdSTEM API key to get started. {"\n"}
          You can find your API key at this link below.
        </Text>
        <Text
          className="text-blue-500 text-center mb-8 font-mono text-lg"
          onPress={() =>
            Linking.openURL("https://edstem.org/us/settings/api-tokens")
          }
        >
          https://edstem.org/us/settings/api-tokens
        </Text>

        <View className="flex flex-row relative items-center gap-x-4 mb-4">
          <TextInput
            className="border border-gray-300 rounded-xl p-4 text-base w-full font-mono"
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
          className={`rounded-xl p-4 items-center ${
            saving || isLoading
              ? "bg-blue-400"
              : "bg-[#71059f] active:bg-blue-700"
          }`}
          onPress={handleSave}
          disabled={saving || isLoading}
        >
          <Text className="text-white text-lg font-display-semibold">
            {saving ? "Saving..." : "Continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
