# LivingRuntime — Google AdSense deployment checklist

Scope: **ownership verification only**. This change does not inject the ad-serving JavaScript, create ad placements, collect ad cookies or enable Auto Ads. It is safe to deploy with the default settings.

## 1. Verify ownership (when you have the real publisher ID)

1. In Google AdSense, add the *actual public site domain* that will host this site (not the development IP).
2. In the deployment environment, set:
   ```dotenv
   ADSENSE_VERIFICATION_ENABLED=true
   ADSENSE_PUBLISHER_ID=ca-pub-<your exact 16-digit publisher number>
   ```
   Never commit the real `.env` file. No test/example ID is shipped or used.
3. Restart/recreate **both** API and Web services; web renders the meta tag, API owns `/ads.txt`.
4. Check `https://YOUR-DOMAIN/` HTML **source** for a single `<meta name="google-adsense-account" content="ca-pub-...">` in `<head>`.
5. Check `https://YOUR-DOMAIN/ads.txt` for **exactly**:
   `google.com, pub-<the same 16 digits>, DIRECT, f08c47fec0942fa0`
   Response must be HTTP 200 and `text/plain`. This is the Google-owned seller record, *not* an ad script.
6. In AdSense choose the **meta tag** or **ads.txt** verification method and request site review.

With default `ADSENSE_VERIFICATION_ENABLED=false` (or a missing/invalid ID), the meta tag is absent and `/ads.txt` is HTTP 404 without advertising identifiers. This is intentional; do **not** create a fake `ads.txt`. If the public domain is served by another app or CDN, make sure its **root** URL is actually routed to this application, not just the dev IP.

## 2. Before turning on advertising

- **Publishing policy:** Review and complete both actual privacy pages (`/privacy`), terms (`/terms`), legal operator identity, contact channel, retention periods and the services you actually use. The present source copies remain drafts with placeholders. The verification text alone does not satisfy consent laws or Google's privacy disclosure requirements.
- **Consent management:** When serving ads to visitors in the EEA, UK or Switzerland, use the appropriate Google-certified CMP integrated with IAB TCF as required. Google's AdSense Privacy & Messaging CMP may be configured *after* registering the site. The current software does not implement one.
- **Ad display:** Do not add AdSense Auto ads / ad units until site review, policy disclosures and CMP decisions are complete. The verification flag intentionally **does not control any ad script**; any future ad runtime should have separate gating and tests.
- **Content quality:** Check substantial original explanations/research, factual source attribution, sensible navigation and no auto-generated low-value pages or content copied without sufficient additional value. A verification success **does not** imply approval.
- **SEO:** Confirm public canonical domain, robots.txt, sitemap.xml, structured metadata, no login requirement, mobile accessibility and site ownership. The current language switch is client-side; it is **not** a completed server-rendered English SEO edition with distinct /en/ pages/hreflang. Do not claim English pages are indexed separately until that work is done.
- **Production:** The new knowledge site must actually be deployed on the same domain you add to AdSense. A dev-only deployment cannot verify the public production site.

## 3. Regression checks

```sh
npm run test:standalone
npm run typecheck
node scripts/adsense-smoke.mjs # checks current preview, default verification OFF
# With default disabled: expect HTTP 404 and NO account meta/script.
curl -si http://127.0.0.1:3000/ads.txt
curl -s http://127.0.0.1:3000/ | grep 'google-adsense-account' # should have no match
```

Google official sources:
- [Connect your site to AdSense](https://support.google.com/adsense/answer/7584263)
- [Ads.txt guide](https://support.google.com/adsense/answer/12171612)
- [Google-certified CMP requirements for EEA, UK, Switzerland](https://support.google.com/adsense/answer/13554116)

**AdSense ownership verification, AdSense site approval, and ads actually serving are separate states.**
