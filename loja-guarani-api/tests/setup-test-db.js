const { execSync } = require("child_process");
const path = require("path");

function setupTestDatabase() {
  const apiDir = path.resolve(__dirname, "..");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe"
  });
}

module.exports = { setupTestDatabase };
