/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile the shared workspace package (ships as TS source).
  transpilePackages: ["@union/shared"],
};

export default nextConfig;
