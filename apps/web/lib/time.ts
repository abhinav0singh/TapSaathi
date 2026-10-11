/**
 * Time formatting for screens that render on both server and browser.
 * The hub runs on India time; a fixed zone and locale keep both sides identical so the page
 * never hydrates with a different string than the server sent.
 */
const ZONE = "Asia/Kolkata";

export function clock(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: ZONE,
  });
}

export function clockWithSeconds(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: ZONE,
  });
}

/** 134000 -> "2:14". Hours roll in once needed: 3,725,000 -> "1:02:05". */
export function elapsed(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}

/** "3 s ago", "2 min ago". */
export function ago(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 90) return `${seconds} s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

/** "29 May 2024, 1:00 pm" */
export function dateTime(date: Date): string {
  return date
    .toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: ZONE,
    })
    .replace(/\bAM\b/, "am")
    .replace(/\bPM\b/, "pm");
}
