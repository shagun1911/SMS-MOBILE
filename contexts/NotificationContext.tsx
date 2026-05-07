import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

export interface InAppNotif {
  id: string;
  title: string;
  body: string;
}

interface NotifContextValue {
  notify: (title: string, body: string) => void;
  current: InAppNotif | null;
  dismiss: () => void;
  unreadCount: number;
  resetUnread: () => void;
}

const NotifContext = createContext<NotifContextValue>({
  notify: () => {},
  current: null,
  dismiss: () => {},
  unreadCount: 0,
  resetUnread: () => {},
});

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<InAppNotif | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setCurrent(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const notify = useCallback((title: string, body: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = Date.now().toString();
    setCurrent({ id, title, body });
    setUnreadCount((c) => c + 1);
    timerRef.current = setTimeout(() => setCurrent(null), 5000);
  }, []);

  const resetUnread = useCallback(() => setUnreadCount(0), []);

  return (
    <NotifContext.Provider
      value={{ notify, current, dismiss, unreadCount, resetUnread }}
    >
      {children}
    </NotifContext.Provider>
  );
}

export const useNotification = () => useContext(NotifContext);
