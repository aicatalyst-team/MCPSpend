'use client'

// Google Analytics 4 — loaded ONLY after the user explicitly accepts cookies.
// Per GDPR + ePrivacy Directive, non-essential trackers must wait for opt-in.
//
// Wire:
//   - Visit 1: CookieConsentBanner renders; consent === null; this component
//     does nothing. gtag.js is never requested.
//   - User clicks "Accept": banner stores consent, dispatches
//     'mcpspend:consent-changed'. We re-read consent, fall through to
//     loading gtag.
//   - User clicks "Decline": consent === 'declined'; we do not load gtag.
//     Re-check on every consent-changed event so a later opt-in flips it on.

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { readConsent, type ConsentStatus } from './CookieConsentBanner'

const GA_ID = 'G-R9HSHBNZ8Q'

export function GoogleAnalytics() {
  const [consent, setConsent] = useState<ConsentStatus>(null)

  useEffect(() => {
    setConsent(readConsent())
    const handler = () => setConsent(readConsent())
    window.addEventListener('mcpspend:consent-changed', handler)
    return () => window.removeEventListener('mcpspend:consent-changed', handler)
  }, [])

  if (consent !== 'accepted') return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            allow_ad_personalization_signals: false,
            anonymize_ip: true,
          });
        `}
      </Script>
    </>
  )
}
