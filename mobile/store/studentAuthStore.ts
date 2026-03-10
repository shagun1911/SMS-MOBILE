import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { asyncStorage } from "@/lib/storage";

export interface StudentUser {
  _id: string;
  firstName: string;
  lastName: string;
  username?: string;
  admissionNumber: string;
  class: string;
  section: string;
  photo?: string;
  schoolId: string;
  schoolCode: string;
  schoolName: string;
  mustChangePassword?: boolean;
}

interface StudentAuthState {
  student: StudentUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (student: StudentUser, token: string, refreshToken: string) => void;
  logout: () => void;
  setTokens: (token: string, refreshToken: string) => void;
  clearMustChange: () => void;
}

export const useStudentAuthStore = create<StudentAuthState>()(
  persist(
    (set) => ({
      student: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (student, token, refreshToken) =>
        set({ student, token, refreshToken, isAuthenticated: true }),

      logout: () =>
        set({
          student: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      setTokens: (token, refreshToken) => set({ token, refreshToken }),

      clearMustChange: () =>
        set((state) =>
          state.student
            ? { student: { ...state.student, mustChangePassword: false } }
            : state
        ),
    }),
    {
      name: "sms-student-auth",
      storage: createJSONStorage(() => asyncStorage),
    }
  )
);
