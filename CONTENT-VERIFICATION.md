# FSG Environmental — homepage reference correction

## Source
- Homepage reference screenshot supplied by the user on 2026-11-16 (`01-fsg-environmental-homepage1.png`).
- Existing project source and supplied original image assets.

## Homepage structure restored in fallback page data
1. Hero: Future Starts Green / Environmental work. Clearly coordinated.
2. On-page anchor navigation.
3. The FSG Approach: Clear scope, Coordinated delivery, Useful records.
4. Our Services directory (11 services, including the separately confirmed Spill Response Support page).
5. Condition assessment by PACP™, LACP™ and MACP™ certified personnel.
6. Planned Maintenance feature split with maintenance-programmes image.
7. Industries cards (five categories).
8. How We Work: four steps from first conversation to closeout.
9. Next-step CTA.
10. Existing shared trusted-partner logo strip and footer.

## Typography
- Changed the site font stack from Inter-first to DM Sans-first, matching the heavier, rounded geometric appearance visible in the supplied reference more closely.
- Existing heading weights, tracking and responsive rules remain in place.
- A pixel-perfect font match cannot be certified from a compressed 562px-wide screenshot; the original font files/font metadata were not supplied.

## Important database behaviour
The backend seeds core pages with `$setOnInsert`, intentionally preserving existing CMS edits. Therefore this source fallback correction does not overwrite an already-existing MongoDB `home` page. To apply the new homepage content to a populated database, review and import the corresponding section data through Admin > Pages, or perform an explicit reviewed CMS update. No database records were deleted or overwritten as part of this correction.

## Verification status
- Homepage fallback data structure updated.
- Screenshot section sequence cross-checked against supplied homepage screenshot.
- Original source images referenced by the page exist in `web/public/images`.
- Production build and browser screenshot comparison remain unverified because dependencies/build environment are not installed in this session.
