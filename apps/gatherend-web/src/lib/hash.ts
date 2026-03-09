import crypto from "crypto";

export function hash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
