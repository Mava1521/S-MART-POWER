import crypto from "crypto";

/**
 * Genera un código legible tipo "USR-7F3K-9QX2".
 * No usamos IDs incrementales para que no sean adivinables.
 */
export function generateInvitationCode() {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `USR-${random.slice(0, 4)}-${random.slice(4, 8)}`;
}
