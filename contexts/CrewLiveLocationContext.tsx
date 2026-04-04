import { createContext, useContext, type ReactNode } from "react";
import { useCrewBusLiveLocation, type CrewLocationShareState } from "@/hooks/useCrewBusLiveLocation";

const CrewLiveLocationContext = createContext<CrewLocationShareState | null>(null);

export function CrewLiveLocationProvider({ children }: { children: ReactNode }) {
  const state = useCrewBusLiveLocation(true);
  return (
    <CrewLiveLocationContext.Provider value={state}>{children}</CrewLiveLocationContext.Provider>
  );
}

export function useCrewLiveLocationShare(): CrewLocationShareState | null {
  return useContext(CrewLiveLocationContext);
}
