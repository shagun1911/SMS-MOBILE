export const CREW_ROLES = ["bus_driver", "conductor"] as const;

export type CrewRole = (typeof CREW_ROLES)[number];

export function isCrewRole(role: string | undefined | null): role is CrewRole {
  return role === "bus_driver" || role === "conductor";
}
