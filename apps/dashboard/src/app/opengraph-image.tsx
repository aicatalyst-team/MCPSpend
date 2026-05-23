// Next.js 15 Open Graph image route — runs on the edge, generates a 1200x630
// PNG on demand. Replaces the static og-image.png we'd otherwise have to
// design in Figma. The output is what Twitter/LinkedIn/Slack/Discord pull
// when someone shares mcpspend.com.

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'MCPSpend — Know what your AI agents really cost'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #0c1a2e 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          padding: '80px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Top: brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '28px', fontWeight: 600 }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: 800,
            }}
          >
            M
          </div>
          MCPSpend
        </div>

        {/* Middle: headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              fontSize: '76px',
              fontWeight: 700,
              letterSpacing: '-2px',
              lineHeight: 1.05,
              color: 'white',
            }}
          >
            Know what every
            <br />
            <span
              style={{
                background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              MCP call costs you.
            </span>
          </div>
          <div style={{ fontSize: '30px', color: '#94a3b8', fontWeight: 400, maxWidth: '900px' }}>
            Cost attribution for Cursor, Claude Desktop, Windsurf & VS Code · one install · 25K calls/mo free
          </div>
        </div>

        {/* Bottom: CTA hint */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '22px',
            color: '#64748b',
            borderTop: '1px solid #1e293b',
            paddingTop: '24px',
          }}
        >
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: '#94a3b8' }}>
            $ npx @mcpspend/proxy init --key ...
          </div>
          <div>mcpspend.com</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
