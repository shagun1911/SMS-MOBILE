/** Normalize phone for comparing staff vs bus crew fields. */
export function normalizePhoneDigits(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

/** Same identity key as backend — one person must not appear on two buses. */
export function staffIdentityKey(name?: string, phone?: string): string | null {
  const n = (name ?? "").trim().toLowerCase();
  const p = normalizePhoneDigits(phone ?? "");
  if (!n && !p) return null;
  return `${n}|${p}`;
}

type StaffLite = { _id: string; name: string; phone?: string };

/**
 * Match saved bus driver/conductor name+phone to a staff `_id` for select value.
 */
export function matchStaffMemberId(
  members: StaffLite[],
  name: string | undefined,
  phone: string | undefined
): string {
  const n = (name || "").trim().toLowerCase();
  if (!n) return "";
  const matches = members.filter((m) => m.name.trim().toLowerCase() === n);
  if (matches.length === 1) return String(matches[0]._id);
  const pd = normalizePhoneDigits(phone || "");
  if (pd) {
    const byPhone = matches.find((m) => normalizePhoneDigits(m.phone || "") === pd);
    if (byPhone) return String(byPhone._id);
  }
  return "";
}
