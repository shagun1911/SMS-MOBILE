/** Accountant, cleaning, and custom “other” staff — shared mobile portal (mirror of crew roles). */
export const SUPPORT_STAFF_ROLES = ["accountant", "cleaning_staff", "staff_other"] as const;

export type SupportStaffRole = (typeof SUPPORT_STAFF_ROLES)[number];

export function isSupportStaffRole(role: string | undefined | null): role is SupportStaffRole {
  return (
    role === "accountant" || role === "cleaning_staff" || role === "staff_other"
  );
}
