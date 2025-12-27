import { defineConfig } from "@vscode/test-cli";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  files: "out/test/**/*.test.js",
  workspaceFolder: __dirname, // ← Явно указываем текущую директорию как workspace
  launchArgs: [
    "--disable-extensions",
    `--user-data-dir=${resolve(__dirname, ".vscode-test", "user-data")}`,
  ],
});
