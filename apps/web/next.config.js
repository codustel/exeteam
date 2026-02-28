/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@exeteam/shared', '@exeteam/ui'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pbzbldirliihaodkxejl.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
