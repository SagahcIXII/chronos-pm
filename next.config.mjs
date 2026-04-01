/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
      }
    }
    return config
  },
  transpilePackages: [],
  experimental: {
    optimizePackageImports: [],
  },
}
export default nextConfig
