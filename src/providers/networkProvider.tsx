import React, { createContext, useContext } from "react";
import { useNetworkState } from "expo-network";

interface NetworkContextType {
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextType>({ isOnline: true });

export function useNetwork() {
  return useContext(NetworkContext);
}

export function NetworkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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
