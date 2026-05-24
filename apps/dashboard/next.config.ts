import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
  // Production security headers. Helmet covers the API at api.mcpspend.com;
  // these set the equivalent baseline for the marketing site + dashboard.
  // Targets an A rating on securityheaders.com.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // HSTS — force HTTPS for 1 year, include subdomains, preload-eligible.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // Clickjacking — we never embed the dashboard inside iframes.
          { key: 'X-Frame-Options', value: 'DENY' },
          // MIME sniffing — let browsers trust our Content-Type headers.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Limit referrer leakage on cross-origin requests.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable browser features we don't use.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ]
  },
}

export default nextConfig
