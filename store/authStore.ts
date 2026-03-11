import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { asyncStorage } from "@/lib/storage";

export interface TeacherUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  schoolId?: string;
  mustChangePassword?: boolean;
  permissions?: string[];
}

interface AuthState {
  user: TeacherUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: TeacherUser, token: string, refreshToken: string) => void;
  logout: () => void;
  setTokens: (token: string, refreshToken: string) => void;
  clearMustChangePassword: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (user, token, refreshToken) =>
        set({ user, token, refreshToken, isAuthenticated: true }),

      logout: () =>
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      setTokens: (token, refreshToken) => set({ token, refreshToken }),

      clearMustChangePassword: () =>
        set((state) =>
          state.user
            ? { user: { ...state.user, mustChangePassword: false } }
            : state
        ),
    }),
    {
      name: "sms-teacher-auth",
      storage: createJSONStorage(() => asyncStorage),
    }
  )
);
