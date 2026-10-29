import { config } from "dotenv";
import { resolve } from "node:path";

// Support running from the repo root, the package directory, or a container
// where the variables are already in process.env.
for (const candidate of [".env", "../../.env", ".env.local", "../../apps/web/.env.local"]) {
  config({ path: resolve(process.cwd(), candidate), override: false, quiet: true });
}
