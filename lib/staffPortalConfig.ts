/**
 * Central config for staff-facing mobile portals (teacher, transport, crew, …).
 * When adding a new role + route group: extend resolveStaffHomeRoute(), add an auth screen,
 * and mirror portal checks on the API (see SMS-Backend auth.controller login).
 */
import { isCrewRole } from "./crewRoles";
import { isSupportStaffRole } from "./supportStaffRoles";

/** POST /auth/login body `portal` value — must match backend. */
export const AUTH_PORTAL_CREW = "crew" as const;
export const AUTH_PORTAL_SUPPORT_STAFF = "support_staff" as const;

/** Expo Router paths for post-login navigation (persisted session resume). */
export const STAFF_HOME_ROUTES = {
  transport_manager: "/(transport)/dashboard",
  teacher: "/(teacher)/dashboard",
  crew: "/(crew)/dashboard",
  support_staff: "/(support)/dashboard",
} as const;

export type StaffHomeRoute = (typeof STAFF_HOME_ROUTES)[keyof typeof STAFF_HOME_ROUTES];

/** Backend UserNotification.type for payroll pushes (salary.service). */
export const USER_NOTIFICATION_TYPE_SALARY = "salary" as const;

export function userNotificationSalaryParams() {
  return { type: USER_NOTIFICATION_TYPE_SALARY };
}

/**
 * Maps stored `user.role` to the correct stack entry. Returns null if this app has no home for the role.
 */
export function resolveStaffHomeRoute(role: string | undefined | null): StaffHomeRoute | null {
  if (!role) return null;
  if (role === "transport_manager") return STAFF_HOME_ROUTES.transport_manager;
  if (isCrewRole(role)) return STAFF_HOME_ROUTES.crew;
  if (isSupportStaffRole(role)) return STAFF_HOME_ROUTES.support_staff;
  if (role === "teacher") return STAFF_HOME_ROUTES.teacher;
  return null;
}
