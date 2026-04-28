import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter, useSegments } from "expo-router";
import {
  getApiKey as getStoredApiKey,
  setApiKey as setStoredApiKey,
  clearApiKey as clearStoredApiKey,
} from "@/src/lib/storage";
import { useFonts } from "expo-font";
import { IntelOneMono_300Light } from "@expo-google-fonts/intel-one-mono/300Light";
import { IntelOneMono_300Light_Italic } from "@expo-google-fonts/intel-one-mono/300Light_Italic";
import { IntelOneMono_400Regular } from "@expo-google-fonts/intel-one-mono/400Regular";
import { IntelOneMono_400Regular_Italic } from "@expo-google-fonts/intel-one-mono/400Regular_Italic";
import { IntelOneMono_500Medium } from "@expo-google-fonts/intel-one-mono/500Medium";
import { IntelOneMono_500Medium_Italic } from "@expo-google-fonts/intel-one-mono/500Medium_Italic";
import { IntelOneMono_600SemiBold } from "@expo-google-fonts/intel-one-mono/600SemiBold";
import { IntelOneMono_600SemiBold_Italic } from "@expo-google-fonts/intel-one-mono/600SemiBold_Italic";
import { IntelOneMono_700Bold } from "@expo-google-fonts/intel-one-mono/700Bold";
import { IntelOneMono_700Bold_Italic } from "@expo-google-fonts/intel-one-mono/700Bold_Italic";

import { PTSerif_400Regular } from "@expo-google-fonts/pt-serif/400Regular";
import { PTSerif_400Regular_Italic } from "@expo-google-fonts/pt-serif/400Regular_Italic";
import { PTSerif_700Bold } from "@expo-google-fonts/pt-serif/700Bold";
import { PTSerif_700Bold_Italic } from "@expo-google-fonts/pt-serif/700Bold_Italic";

import { Rokkitt_100Thin } from "@expo-google-fonts/rokkitt/100Thin";
import { Rokkitt_100Thin_Italic } from "@expo-google-fonts/rokkitt/100Thin_Italic";
import { Rokkitt_200ExtraLight } from "@expo-google-fonts/rokkitt/200ExtraLight";
import { Rokkitt_200ExtraLight_Italic } from "@expo-google-fonts/rokkitt/200ExtraLight_Italic";
import { Rokkitt_300Light } from "@expo-google-fonts/rokkitt/300Light";
import { Rokkitt_300Light_Italic } from "@expo-google-fonts/rokkitt/300Light_Italic";
import { Rokkitt_400Regular } from "@expo-google-fonts/rokkitt/400Regular";
import { Rokkitt_400Regular_Italic } from "@expo-google-fonts/rokkitt/400Regular_Italic";
import { Rokkitt_500Medium } from "@expo-google-fonts/rokkitt/500Medium";
import { Rokkitt_500Medium_Italic } from "@expo-google-fonts/rokkitt/500Medium_Italic";
import { Rokkitt_600SemiBold } from "@expo-google-fonts/rokkitt/600SemiBold";
import { Rokkitt_600SemiBold_Italic } from "@expo-google-fonts/rokkitt/600SemiBold_Italic";
import { Rokkitt_700Bold } from "@expo-google-fonts/rokkitt/700Bold";
import { Rokkitt_700Bold_Italic } from "@expo-google-fonts/rokkitt/700Bold_Italic";
import { Rokkitt_800ExtraBold } from "@expo-google-fonts/rokkitt/800ExtraBold";
import { Rokkitt_800ExtraBold_Italic } from "@expo-google-fonts/rokkitt/800ExtraBold_Italic";
import { Rokkitt_900Black } from "@expo-google-fonts/rokkitt/900Black";
import { Rokkitt_900Black_Italic } from "@expo-google-fonts/rokkitt/900Black_Italic";

interface KeyContextType {
  apiKey: string | null;
  setApiKey: (key: string) => Promise<void>;
  clearApiKey: () => Promise<void>;
  isLoading: boolean;
}

const KeyContext = createContext<KeyContextType>({
  apiKey: null,
  setApiKey: async () => {},
  clearApiKey: async () => {},
  isLoading: true,
});

export function useApiKey() {
  return useContext(KeyContext);
}

export function KeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(getStoredApiKey);
  const router = useRouter();
  const segments = useSegments();

  /*
   * Temporary workaround to keep fonts loaded globally as expo config does not load them
   */
  const [fontsLoaded] = useFonts({
    // IntelOneMono
    IntelOneMono_300Light,
    IntelOneMono_300Light_Italic,
    IntelOneMono_400Regular,
    IntelOneMono_400Regular_Italic,
    IntelOneMono_500Medium,
    IntelOneMono_500Medium_Italic,
    IntelOneMono_600SemiBold,
    IntelOneMono_600SemiBold_Italic,
    IntelOneMono_700Bold,
    IntelOneMono_700Bold_Italic,
    // PTSerif
    PTSerif_400Regular,
    PTSerif_700Bold,
    PTSerif_400Regular_Italic,
    PTSerif_700Bold_Italic,
    // Rokkitt
    Rokkitt_100Thin,
    Rokkitt_200ExtraLight,
    Rokkitt_300Light,
    Rokkitt_400Regular,
    Rokkitt_500Medium,
    Rokkitt_600SemiBold,
    Rokkitt_700Bold,
    Rokkitt_800ExtraBold,
    Rokkitt_900Black,
    Rokkitt_100Thin_Italic,
    Rokkitt_200ExtraLight_Italic,
    Rokkitt_300Light_Italic,
    Rokkitt_400Regular_Italic,
    Rokkitt_500Medium_Italic,
    Rokkitt_600SemiBold_Italic,
    Rokkitt_700Bold_Italic,
    Rokkitt_800ExtraBold_Italic,
    Rokkitt_900Black_Italic,
  });

  useEffect(() => {
    if (!fontsLoaded) return;

    const inApiKeyRoute = segments[0] === "api-key";

    if (!apiKey && !inApiKeyRoute) {
      router.replace("/api-key");
    } else if (apiKey && inApiKeyRoute) {
      router.replace("/");
    }
  }, [apiKey, segments, router, fontsLoaded]);

  const handleSetApiKey = useCallback(async (key: string) => {
    setStoredApiKey(key);
    setApiKeyState(key);
  }, []);

  const handleClearApiKey = useCallback(async () => {
    clearStoredApiKey();
    setApiKeyState(null);
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <KeyContext.Provider value={{ apiKey, setApiKey: handleSetApiKey, clearApiKey: handleClearApiKey, isLoading: !fontsLoaded }}>
      {children}
    </KeyContext.Provider>
  );
}
