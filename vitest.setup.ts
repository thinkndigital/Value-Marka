try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional if the environment already has the required vars set.
}

process.env.SESSION_SECRET ??=
  "test-only-secret-not-for-production-0123456789abcdef";
