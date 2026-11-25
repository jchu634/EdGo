import { useNetworkState } from "expo-network";
import type React from "react";
import { createContext, useContext } from "react";

interface NetworkContextType {
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextType>({ isOnline: true });

export function useNetwork() {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const networkState = useNetworkState();

  const isOnline =
    networkState.isConnected !== false &&
    networkState.isInternetReachable !== false;

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
    </NetworkContext.Provider>
  );
}
