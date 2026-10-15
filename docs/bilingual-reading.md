# LivingRuntime bilingual UI and content provenance

The desktop sidebar and mobile bar expose EN / 中文. The reading preference persists in the browser. Only one AIHot ingestion dataset and one Graphiti/Neo4j graph exist, shared across languages.

## English mode

The public routes now have English experiences: homepage, news feed, hot/events, event detail, original article, graph and entity pages, topics and topic details, daily/weekly/monthly report pages, archive, about, updates, bookmarks, feedback, agent integration, privacy, terms, search busy and login.

- Reports and source cards reuse `original_title` from the stored publication, and do not re-label a Chinese-generated editorial summary as English.
- English event pages link to original-source reporting. When the source is Chinese, a clear English explanation and link are shown. Graphiti assertions may have source-language texts; the English UI offers evidence links rather than inventing a translation.
- Daily, weekly and monthly English pages show source-linked **English digests**. The existing Chinese-authored editorial analysis, and any historical Chinese-only reports, are NOT fully translated. Translation is outstanding, not silently hidden as completed.
- The Chinese reading experience, data ids, Graphiti receipts and ingestion paths are retained.
- Feedback remains postable on the English page, including optional screenshot and email. Legal pages display English renderings of the source policy **drafts**, explicitly noting that operator and AdSense/CMP details still require completion.

## SEO and QA boundaries

This is a client-side language preference. SSR and canonical URLs remain Chinese. It must not be advertised as an indexed separate English edition until stable localized English URLs, complete editorial translations and hreflang exist.

Checks:
```sh
npm run typecheck
node scripts/english-site-smoke.mjs
node scripts/english-coverage.mjs
node scripts/language-switch-smoke.mjs
node scripts/knowledge-ui-smoke.mjs
```

Smoke tests cover route availability and original title data, **not** a real Chromium click-and-screenshot pass. Playwright Chromium was not available on the development host at validation time. No production deployment is implied.

## English DOM regression gate (2026-10-15)

The root script `npm run audit:english` performs three checks against the running dev site at `http://127.0.0.1:3000` (or `PREVIEW_URL`): exact `en-US` day/time renderers, Playwright Chromium crawling of 26 public/representative routes at 1365×860 and 390×844, and interactive English popup scans (search, filter, participant and ranking disclosure).

Audit logic sets `livingruntime-language=en` in browser storage, waits until the client language is active, checks visible DOM text and attributes (`aria-label`, `title`, `placeholder`, `alt`), document title/description, response status and uncaught JavaScript exceptions. It excludes the language selector itself since the Chinese-language choice is intentionally labeled “中文”. A nonzero result exits with failure. The script is a regression check of sampled dynamic content, not a claim that source archives already have full English editorial translations.

The live crawl reported `checked=52, offendingStrings=0, affectedScreens=0` after fixing shared date/count renderers and React hydration. React SSR incorrectly hoisted an SVG `<title>` element inside knowledge graph links, causing hydration error #418. Replaced it with an `aria-label` on the interactive SVG links. Both English and Chinese share the deterministic graph layout. Source-original articles, event graph, reports, navigation and source references remained functional.
