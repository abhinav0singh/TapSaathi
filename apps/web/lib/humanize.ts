/** SUPERVISOR_UNACKNOWLEDGED -> "Supervisor unacknowledged". */
export function humanize(value: string): string {
  const text = value.toLowerCase().split(/[_\s]+/).filter(Boolean).join(" ");
  return text ? text.replace(/^./, (first) => first.toUpperCase()) : value;
}
