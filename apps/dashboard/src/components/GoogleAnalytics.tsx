// Google Analytics 4 — loaded after the page is interactive so it never
// blocks first paint. The measurement ID is hard-coded because gtag only
// accepts a static value (and it's a public ID anyway — visible in any
// browser's network tab). We turn off ad-personalization signals to keep
// our footprint as small as the GDPR conversation allows.

import Script from 'next/script'

const GA_ID = 'G-R9HSHBNZ8Q'

export function GoogleAnalytics() {
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
            // Minimise the data we ship. IP gets hashed/truncated by Google
            // anyway in GA4, but allow_ad_personalization_signals: false makes
            // sure we don't end up in Google Ads audiences by accident.
            allow_ad_personalization_signals: false,
            anonymize_ip: true,
          });
        `}
      </Script>
    </>
  )
}
