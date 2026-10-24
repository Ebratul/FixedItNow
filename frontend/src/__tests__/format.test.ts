import { describe, expect, it } from "vitest";
import { dhakaDateKey, dhakaLocalToIso, formatBdt, formatDuration, formatRange, formatTime } from "@/lib/format";
import { validateDays } from "@/components/bookings/availability-editor";

describe("Bangladesh-time formatting", () => {
  it("always renders in Asia/Dhaka, regardless of the machine's zone", () => {
    expect(formatTime("2026-11-04T04:00:00Z")).toBe("10:00 AM");
    expect(formatTime("2026-11-04T14:30:00Z")).toBe("8:30 PM");
  });
  it("formats a range with date and both times", () => {
    expect(formatRange("2026-11-04T04:00:00Z", "2026-11-04T05:30:00Z")).toBe("Wed, 4 Nov 2026 · 10:00 AM – 11:30 AM");
  });
  it("uses the Dhaka calendar day around midnight UTC", () => {
    expect(dhakaDateKey(new Date("2026-11-01T20:30:00Z"))).toBe("2026-11-02");
    expect(dhakaDateKey(new Date("2026-11-01T17:59:00Z"))).toBe("2026-11-01");
  });
  it("reads datetime-local input as Dhaka time", () => {
    expect(dhakaLocalToIso("2026-11-05T10:00")).toBe("2026-11-05T04:00:00.000Z");
  });
  it("formats taka and durations", () => {
    expect(formatBdt(1150)).toBe("৳1,150");
    expect(formatDuration(90)).toBe("1 hr 30 min");
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(120)).toBe("2 hr");
  });
});

describe("validateDays", () => {
  it("accepts empty days, adjacent windows, and flags bad ones", () => {
    const days = Array.from({ length: 7 }, () => [] as { start: number; end: number }[]);
    expect(validateDays(days).every((v) => v === undefined)).toBe(true);
    days[1] = [{ start: 480, end: 720 }, { start: 720, end: 900 }];
    days[2] = [{ start: 480, end: 720 }, { start: 700, end: 900 }];
    days[3] = [{ start: 600, end: 600 }];
    const result = validateDays(days);
    expect(result[1]).toBeUndefined();
    expect(result[2]).toMatch(/overlap/);
    expect(result[3]).toMatch(/end after/);
  });
});
