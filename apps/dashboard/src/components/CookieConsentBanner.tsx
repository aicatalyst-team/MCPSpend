'use client'

// GDPR + ePrivacy-compliant consent banner.
//
// Rules we follow (per EDPB + Romanian ANSPDCP guidance):
//   - Non-essential trackers (Google Analytics) MUST NOT fire before consent.
//   - Default state = no consent. "Accept" requires an explicit affirmative
//     action — clicking Accept. Closing the banner is NOT consent.
//   - "Decline" must be as visually easy as "Accept" (no dark patterns).
//   - Choice must be revocable — settings link in the footer is enough.
//   - Re-prompt after 12 months (consent is not permanent).
//
// We expose two custom events the rest of the app can hook into:
//   window.dispatchEvent(new Event('mcpspend:consent-changed'))
// The GoogleAnalytics component listens for it and loads gtag on accept.

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'mcpspend_cookie_consent'
const STORAGE_AT_KEY = 'mcpspend_cookie_consent_at'
const RECONSENT_AFTER_MS = 365 * 24 * 60 * 60 * 1000 // 12 months

export type ConsentStatus = 'accepted' | 'declined' | null

export function readConsent(): ConsentStatus {
  if (typeof window === 'undefined') return null
  const v = localStorage.getItem(STORAGE_KEY)
  if (v !== 'accepted' && v !== 'declined') return null
  const at = parseInt(localStorage.getItem(STORAGE_AT_KEY) || '0', 10)
  if (!at || Date.now() - at > RECONSENT_AFTER_MS) return null
  return v
}

export function writeConsent(status: 'accepted' | 'declined') {
  localStorage.setItem(STORAGE_KEY, status)
  localStorage.setItem(STORAGE_AT_KEY, String(Date.now()))
  window.dispatchEvent(new Event('mcpspend:consent-changed'))
}

export function CookieConsentBanner() {
  // Render nothing until we've checked localStorage on the client — prevents
  // a brief flash of the banner on every page for accepting users.
  const [status, setStatus] = useState<ConsentStatus | 'loading'>('loading')

  useEffect(() => {
    setStatus(readConsent())
  }, [])

  if (status === 'loading' || status !== null) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50"
    >
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur">
        <h2 className="text-white font-semibold text-base">Cookies & analytics</h2>
        <p className="text-sm text-gray-300 mt-2 leading-relaxed">
          We use a single cookie to keep you signed in (always on) and{' '}
          <strong>optional</strong> Google Analytics on marketing pages to learn
          what content brings developers in. We never sell data and never run ad
          trackers.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Read more in our{' '}
          <Link href="/privacy" className="text-brand-400 hover:underline">Privacy Policy</Link>.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => { writeConsent('declined'); setStatus('declined') }}
            className="flex-1 bg-white/5 border border-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => { writeConsent('accepted'); setStatus('accepted') }}
            className="flex-1 bg-white text-gray-950 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
