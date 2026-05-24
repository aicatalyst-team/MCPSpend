import type { MetadataRoute } from 'next'

/**
 * /robots.txt — points crawlers at the sitemap + blocks the authenticated
 * dashboard from being indexed (no point, and gives away login URLs).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/dashboard/', '/api/'] },
    ],
    sitemap: 'https://mcpspend.com/sitemap.xml',
    host: 'https://mcpspend.com',
  }
}
