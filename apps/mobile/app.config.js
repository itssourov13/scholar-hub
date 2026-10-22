const fs = require("node:fs");
const path = require("node:path");

/**
 * Firebase configuration is specific to the ScholarHub Android package. Do not
 * ship the old BairePorbo google-services.json with the new application ID.
 * For local builds, place a newly generated file at android/app/google-services.json.
 * For EAS, set GOOGLE_SERVICES_JSON to an EAS file-type environment variable.
 */
module.exports = ({ config }) => {
  const localFile = "./android/app/google-services.json";
  const suppliedFile = process.env.GOOGLE_SERVICES_JSON;
  const localExists = fs.existsSync(path.join(__dirname, "android/app/google-services.json"));
  const googleServicesFile = suppliedFile || (localExists ? localFile : undefined);

  const android = { ...config.android };
  delete android.googleServicesFile;
  if (googleServicesFile) android.googleServicesFile = googleServicesFile;

  const extra = { ...config.extra };
  const apiBase = process.env.EXPO_PUBLIC_API_BASE?.trim();
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  const requiresDeployedApi = buildProfile === "production" || buildProfile === "preview";
  if (apiBase) {
    const normalizedApiBase = apiBase.replace(/\/+$/, "");
    if (requiresDeployedApi) {
      let parsedApiBase;
      try { parsedApiBase = new URL(normalizedApiBase); } catch {
        throw new Error("EXPO_PUBLIC_API_BASE must be an absolute HTTPS URL for EAS preview/production builds.");
      }
      if (parsedApiBase.protocol !== "https:" || /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/i.test(parsedApiBase.hostname)) {
        throw new Error("EXPO_PUBLIC_API_BASE must use a publicly reachable HTTPS host for EAS preview/production builds.");
      }
    }
    extra.apiBase = normalizedApiBase;
  } else {
    delete extra.apiBase;
    if (requiresDeployedApi) {
      throw new Error(`EXPO_PUBLIC_API_BASE must be set to the deployed ScholarHub API URL for the EAS ${buildProfile} profile.`);
    }
  }

  return {
    ...config,
    android,
    extra,
  };
};
