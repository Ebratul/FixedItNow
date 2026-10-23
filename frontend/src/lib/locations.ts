/** The eight administrative divisions of Bangladesh. */
export const DIVISIONS = [
  "Dhaka",
  "Chattogram",
  "Rajshahi",
  "Khulna",
  "Barishal",
  "Sylhet",
  "Rangpur",
  "Mymensingh",
] as const;

export type Division = (typeof DIVISIONS)[number];

export function isDivision(value: string | undefined): value is Division {
  return !!value && (DIVISIONS as readonly string[]).includes(value);
}
