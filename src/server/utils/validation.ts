export function text(value: unknown, label: string, min = 1, max = 1000): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new Error(`${label} must be between ${min} and ${max} characters`);
  return value.trim();
}
export function choice<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw new Error(`Invalid ${label}`);
  return value as T;
}
export function whole(value: unknown, label: string, min = 0, max = 1_000_000): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${label} must be an integer between ${min} and ${max}`);
  return value as number;
}
