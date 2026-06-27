/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output keeps the build self-contained for VPS / Docker
  // deployment alongside the `data/` directory. Vercel-like serverless
  // environments are NOT supported by design — the app reads / writes
  // files in `data/` at runtime.
  output: "standalone",
  // Pull `data/` into the standalone build's trace set so a `cp -r`
  // deploy gets the JSON + photos together. (Moved out of
  // `experimental` in Next 15.5.)
  outputFileTracingIncludes: {
    "/": ["./data/**/*"],
  },
};

module.exports = nextConfig;
