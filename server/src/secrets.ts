import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

let cached: string | null = null;

/** Secret Manager is the source of truth; the env var exists only for local dev. */
export async function geminiKey(): Promise<string> {
  if (cached) return cached;

  const local = process.env.GEMINI_API_KEY;
  if (local) {
    cached = local;
    return cached;
  }

  const project =
    process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "airlock-ideathon";
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${project}/secrets/GEMINI_API_KEY/versions/latest`,
  });

  const key = version.payload?.data?.toString();
  if (!key) throw new Error("GEMINI_API_KEY has no payload in Secret Manager.");
  cached = key;
  return cached;
}
