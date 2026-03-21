/**
 * Privacy-first defaults for this phase.
 * Readable health/wellness payloads must NOT sync to central storage unless explicitly enabled.
 *
 * Set NEXT_PUBLIC_SYNC_HEALTH_TO_CLOUD=true only if you intentionally run the legacy cloud path
 * (requires matching Supabase schema and user consent).
 */
export const CAN_SYNC_HEALTH_DATA_TO_CLOUD =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_SYNC_HEALTH_TO_CLOUD === "true";
