import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const loadEnvFile = async (envPath) => {
  try {
    const raw = await readFile(envPath, "utf8");
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) {
        return;
      }
      const key = match[1];
      const value = match[2].trim().replace(/^"|"$/g, "");
      if (value) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
};

const fileExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const cwdEnvPath = resolve(process.cwd(), ".env.local");
const scriptEnvPath = resolve(new URL("../.env.local", import.meta.url).pathname);
let loadedFrom = null;

if (await fileExists(cwdEnvPath)) {
  await loadEnvFile(cwdEnvPath);
  loadedFrom = cwdEnvPath;
}

if (!process.env.NVIDIA_API_KEY) {
  if (await fileExists(scriptEnvPath)) {
    await loadEnvFile(scriptEnvPath);
    loadedFrom = scriptEnvPath;
  }
}

const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) {
  console.error("NVIDIA_API_KEY is missing. Add it to apps/web/.env.local and retry.");
  process.exit(1);
}

if (loadedFrom) {
  console.log(`Loaded env from ${loadedFrom}`);
}

const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";

const payload = {
  model: "google/gemma-4-31b-it",
  messages: [{ role: "user", content: "Say hello in one sentence." }],
  max_tokens: 256,
  temperature: 1.0,
  top_p: 0.95,
  stream: false,
  chat_template_kwargs: { enable_thinking: true },
};

const response = await fetch(invokeUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const errorText = await response.text();
  console.error(`Request failed (${response.status}): ${errorText}`);
  process.exit(1);
}

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
