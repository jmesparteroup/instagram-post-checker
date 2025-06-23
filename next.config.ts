import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable compression for better performance
  compress: true,
  
  // Optimize images (Instagram content)
  images: {
    domains: [
      'instagram.com', 
      'cdninstagram.com', 
      'scontent.cdninstagram.com',
      'scontent-lga3-1.cdninstagram.com',
      'scontent-lga3-2.cdninstagram.com',
      'scontent-lhr8-1.cdninstagram.com',
      'scontent-lhr8-2.cdninstagram.com'
    ],
    formats: ['image/webp', 'image/avif'],
    // Allow any subdomain of cdninstagram.com
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: 'scontent*.cdninstagram.com',
      },
    ],
  },
  
  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Performance headers
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes should not be cached
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
  
  // Environment variable validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Output configuration for Docker deployment
  output: 'standalone',
  
  // Experimental features for better performance
  // experimental: {
  //   optimizeCss: true, // Disabled due to build issues
  // },
};

export default nextConfig;
