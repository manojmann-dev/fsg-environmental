# Rebuild / verification report

- Added the missing user-provided 24/7 Environmental Support Arrangements reference screenshot to `reference-screenshots/`.
- Added screenshot-specific 24/7 service card descriptions, scope descriptions, delivery intro, planning intro and step copy, image caption, related-service links, and CTA copy.
- Updated service detail rendering to consume page-specific copy fields rather than forcing the same paragraph into every card.
- Service FAQ answers remain blank where the screenshot only shows collapsed questions; no unseen answer text has been fabricated.
- Added anchor navigation and matching section IDs to service detail pages.
- Retained Spill Response Support as the 11th service page.

## Not verified in this environment
- Next.js production build and browser visual comparison (dependencies are not installed / install previously timed out).
- MongoDB-backed admin content, authentication, SMTP delivery, and PDF generation against live credentials.
- Full screenshot-by-screenshot content certification for all other pages.
