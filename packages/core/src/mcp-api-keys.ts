import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const API_KEY_PATTERN = /^cry_[a-zA-Z0-9_-]{20,}$/;

interface KeyStore {
  keys: {
    [key: string]: {
      sandboxId: string;
      createdAt: string;
      lastUsed?: string;
    };
  };
}

async function getKeysFilePath(dataDir: string): Promise<string> {
  return path.join(dataDir, "mcp-api-keys.json");
}

async function loadKeyStore(dataDir: string): Promise<KeyStore> {
  const filePath = await getKeysFilePath(dataDir);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { keys: {} };
  }
}

async function saveKeyStore(dataDir: string, store: KeyStore): Promise<void> {
  const filePath = await getKeysFilePath(dataDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2));
}

export async function validateApiKey(
  apiKey: string,
  dataDir: string
): Promise<boolean> {
  if (!apiKey || !API_KEY_PATTERN.test(apiKey)) {
    return false;
  }

  const store = await loadKeyStore(dataDir);
  const keyInfo = store.keys[apiKey];

  if (!keyInfo) {
    return false;
  }

  // Update last used timestamp
  keyInfo.lastUsed = new Date().toISOString();
  await saveKeyStore(dataDir, store);

  return true;
}

export async function generateApiKey(
  sandboxId: string,
  dataDir: string
): Promise<string> {
  const randomPart = crypto.randomBytes(15).toString("base64url");
  const apiKey = `cry_${randomPart}`;

  const store = await loadKeyStore(dataDir);
  store.keys[apiKey] = {
    sandboxId,
    createdAt: new Date().toISOString(),
  };
  await saveKeyStore(dataDir, store);

  return apiKey;
}

export async function getOrCreateApiKey(
  sandboxId: string,
  dataDir: string
): Promise<string> {
  // Check for existing key file in project
  const keyFilePath = path.join(dataDir, "projects", sandboxId, ".mcp-key");

  try {
    const existingKey = await fs.readFile(keyFilePath, "utf-8");
    if (API_KEY_PATTERN.test(existingKey.trim())) {
      return existingKey.trim();
    }
  } catch {
    // No existing key
  }

  // Generate new key
  const newKey = await generateApiKey(sandboxId, dataDir);

  // Save to project directory
  await fs.mkdir(path.dirname(keyFilePath), { recursive: true });
  await fs.writeFile(keyFilePath, newKey);

  return newKey;
}
