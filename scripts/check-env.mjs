#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const localEnvironmentPath = path.join(repositoryRoot, ".env.local");

function readEnvFile(filePath) {
  try {
    const values = {};
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) values[match[1]] = match[2];
    }
    return values;
  } catch {
    return {};
  }
}

const isContinuousIntegration =
  process.env.CI === "true" || process.env.NETLIFY === "true";
const environment = {
  ...readEnvFile(localEnvironmentPath),
  ...process.env,
};

const requiredForProduction = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
];
const recommended = [
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];

const missingRequired = requiredForProduction.filter(
  (key) => !String(environment[key] ?? "").trim(),
);
const missingRecommended = recommended.filter(
  (key) => !String(environment[key] ?? "").trim(),
);

if (isContinuousIntegration && missingRequired.length > 0) {
  console.error(
    `Out Of Sight: missing required Netlify environment variables: ${missingRequired.join(", ")}`,
  );
  process.exit(1);
}

if (
  !isContinuousIntegration &&
  missingRequired.length > 0 &&
  !process.env.OOS_QUIET_ENV_CHECK
) {
  console.warn(
    `Out Of Sight: Supabase/background work is disabled until these values are set in .env.local: ${missingRequired.join(", ")}`,
  );
}

if (
  missingRecommended.length > 0 &&
  !process.env.OOS_QUIET_ENV_CHECK
) {
  console.warn(
    `Out Of Sight: push notifications are incomplete without: ${missingRecommended.join(", ")}`,
  );
}
