import { useEffect } from "react";
import { useGlobalRefreshOptional } from "@/contexts/GlobalRefreshContext";

/**
 * When the user pulls to refresh on this screen, `refreshFn` runs (with any other
 * currently registered screens — typically only the visible one is mounted).
 */
export function useRegisterScreenRefresh(refreshFn: () => Promise<void>) {
  const ctx = useGlobalRefreshOptional();
  useEffect(() => {
    if (!ctx) return;
    return ctx.registerRefresh(refreshFn);
  }, [ctx, refreshFn]);
}
