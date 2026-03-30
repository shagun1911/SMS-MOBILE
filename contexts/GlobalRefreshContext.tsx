import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type RefreshHandler = () => Promise<void>;

type GlobalRefreshContextValue = {
  /** Register this screen’s reload; unregisters on cleanup. */
  registerRefresh: (fn: RefreshHandler) => () => void;
  isRefreshing: boolean;
  onPullRefresh: () => Promise<void>;
};

const GlobalRefreshContext = createContext<GlobalRefreshContextValue | null>(null);

export function GlobalRefreshProvider({ children }: { children: React.ReactNode }) {
  const handlersRef = useRef(new Set<RefreshHandler>());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const registerRefresh = useCallback((fn: RefreshHandler) => {
    handlersRef.current.add(fn);
    return () => {
      handlersRef.current.delete(fn);
    };
  }, []);

  const onPullRefresh = useCallback(async () => {
    const fns = [...handlersRef.current];
    setIsRefreshing(true);
    try {
      if (fns.length === 0) {
        await new Promise((r) => setTimeout(r, 350));
        return;
      }
      await Promise.all(
        fns.map((f) =>
          Promise.resolve()
            .then(() => f())
            .catch(() => {})
        )
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      registerRefresh,
      isRefreshing,
      onPullRefresh,
    }),
    [registerRefresh, isRefreshing, onPullRefresh]
  );

  return (
    <GlobalRefreshContext.Provider value={value}>{children}</GlobalRefreshContext.Provider>
  );
}

export function useGlobalRefresh() {
  const ctx = useContext(GlobalRefreshContext);
  if (!ctx) {
    throw new Error("useGlobalRefresh must be used within GlobalRefreshProvider");
  }
  return ctx;
}

/** Optional: use when a component may render outside the provider. */
export function useGlobalRefreshOptional() {
  return useContext(GlobalRefreshContext);
}
