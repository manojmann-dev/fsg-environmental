# FSG Environmental — Next.js + Express + MongoDB

A responsive recreation of the uploaded FSG Environmental website screenshots, with a separate admin workspace for project enquiries, leads, service packages, quotations, invoices, SMTP email and company settings.

## Reference pages included

- Home
- Services directory
- 11 service detail pages: Vacuum & Drainage Maintenance; Stormwater Maintenance & Inspections; Hydro Excavation & Utility Support; Industrial Cleaning & Hydroblasting; Environmental Compliance & EHS Support; 24/7 Environmental Support Arrangements; Environmental Remediation; Civil & Drainage Restoration; Demolition & Decommissioning; Environmental Sampling & Soil Assessment; Spill Response Support
- Industries
- About FSG
- How We Work
- Contact / project-scope form
- Admin workspace at `/admin`

The full-page screenshots were the design reference. The hero photographs in this build are crops from the uploaded screenshots because original, separately exported photo files and a vector logo were not included. Replace those crops with the original source photographs and approved logo before production if higher-resolution media is available. The supplied screenshots are desktop references; the site uses responsive layouts for mobile, but no separate mobile reference screenshots were supplied.

## Stack

- Next.js 16.4.6 / React 19.3 frontend (`web/`)
- Express 5 API (`server/`)
- MongoDB Atlas with Mongoose
- bcryptjs password hashing + JWT in HTTP-only admin session cookie
- Nodemailer SMTP delivery
- AES-256-GCM encryption for SMTP passwords stored in MongoDB
- PDFKit for quotation and invoice PDFs
- GSAP + ScrollTrigger for page reveal motion

## 1. Requirements

- Node.js 20.19+ (Node 22 LTS recommended)
- npm 10+
- MongoDB Atlas database/cluster or local MongoDB
- SMTP account or transactional email provider for live emails

## 2. Configure MongoDB and secrets

In the project root, copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Update at least these variables:

```env
NODE_ENV=development
WEB_ORIGIN=http://localhost:3000
PORT=5000
MONGODB_URI=mongodb+srv://DB_USER:URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/fsg_environmental?retryWrites=true&w=majority
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=choose-a-unique-password-with-12-or-more-characters
JWT_SECRET=use-a-random-secret-of-at-least-48-characters
EMAIL_ENCRYPTION_KEY=64-hex-characters-from-32-random-bytes
```

Generate the two secrets in PowerShell (run separately):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the first output for `JWT_SECRET` and the second output for `EMAIL_ENCRYPTION_KEY`. Never put MongoDB, SMTP, JWT or encryption secrets in `NEXT_PUBLIC_*` variables, commit `.env`, or share secrets in chat.

For MongoDB Atlas:

1. Create a database user with a strong password and read/write access to `fsg_environmental`.
2. Use the Atlas Node.js connection string and URL-encode special characters in the username/password.
3. In Atlas Network Access, allow your development machine's current public IP for local testing.
4. For Vercel production, use the Atlas/Vercel integration or a documented Vercel networking approach. Avoid opening the database to all IPs unless you have assessed that security trade-off.
5. Confirm your cluster is running and the URI points to the correct cluster and database.

The first successful API database connection creates the initial admin account from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, if that email does not already exist. For security, the password is hashed with bcrypt. Changing the environment variable later does not reset an existing account; use Admin → Settings & Profile to change the password while signed in.

## 3. Install and run locally (Windows PowerShell)

Open PowerShell in the extracted `FSG-Environmental-Next` folder:

```powershell
npm install
Copy-Item web/.env.local.example web/.env.local
npm run dev
```

Open:

- Website: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- API health: `http://localhost:5000/api/health`

Sign in using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values from the root `.env` file. These are the values you set; the ZIP intentionally contains no shared/default admin password.

If the API health check reports a MongoDB connection error, check the Atlas IP allowlist, database user permissions, URI, password URL encoding and cluster status. The website pages can render without a connected database, but admin login and enquiry persistence require the API and database to be available.

## 4. Configure live email

After signing in, open **Admin → Email Setup** and enter:

- SMTP host
- SMTP port (587 for STARTTLS is typical; 465 for implicit TLS)
- Secure toggle (enable for implicit TLS, typically port 465)
- SMTP username and app password
- From name and verified From email
- Enquiry notification inbox
- Optional reply-to address

Save settings, then use the test email control. The SMTP password is encrypted in the database with `EMAIL_ENCRYPTION_KEY`; the admin screen never displays a saved password. If the encryption key changes, previously stored SMTP credentials cannot be decrypted and must be saved again.

A public enquiry is saved to MongoDB before notification delivery is attempted. The API reports whether the email notification succeeded; a failed mail send does not delete the enquiry. Replies from the admin panel are emailed and added to the enquiry history. Configure SPF, DKIM and DMARC with your email provider before production.

## 5. Admin workflows

- **Dashboard:** enquiry, lead, quotation, invoice and paid-value summary.
- **Enquiries:** search, inspect project briefs, update status, write internal notes through the API, reply by email, convert to lead and create a draft quotation from the enquiry.
- **Leads:** update pipeline stage, owner and estimated value.
- **Service packages:** create and delete reusable service packages with line items, currency and tax rate; insert an active saved package into a quotation or invoice draft.
- **Quotations:** create manually or from an enquiry, edit saved drafts, calculate totals on the server, download professional PDFs and email PDFs to the client.
- **Invoices:** create manually or from a quotation, edit, download PDF, email PDF and update payment state.
- **Email setup:** configure SMTP and send a test email.
- **Pages & layouts:** create pages, edit URL slugs and navigation labels, publish/unpublish, set sort order, manage SEO and show/hide navigation entries. Build each page from ordered section blocks (`hero`, `cards`, `services`, `steps`, `cta`, `richText`, `faq`, `form`). Use each block's `visible` flag to hide a section without deleting it. The section JSON editor exposes the full layout data so content can be updated without changing React code.
- **Contact page:** manage the hero, contact introduction, form heading and copy, office phone/email/address, incident information, CTA, SEO and visibility. Pick which published form is used for the contact page.
- **Branches:** add and edit branch name, label, address, map link, contact details, opening hours and sort order. `Visible` and `Show on contact page` independently control whether a branch appears publicly; the whole branches section can also be hidden from Contact Page settings.
- **Form builder:** create multiple forms with unique slugs, page assignments, fields, field types, required flags, full/half widths, order, grid columns, field/button colours and corner radius. Add or reorder fields in the form schema editor and review the preview. Embed a form in a page by adding a `form` section and setting its `data.formSlug`; the form is checked against its assigned page on both fetch and submission.
- **Email templates:** create separate templates for auto-reply, admin notification, manual reply and other messages. Configure To, CC, BCC, From name, verified From email, Reply-to, subject, trigger and enabled state. Edit the email header, middle/body and footer independently and change their display order. Templates support dynamic values such as `{{customer.name}}`, `{{customer.email}}`, `{{customer.phone}}`, `{{customer.company}}`, `{{customer.service}}`, `{{form.name}}`, `{{submission.id}}`, `{{fields.siteLocation}}`, `{{company.name}}` and `{{company.notificationEmail}}`. Map auto-reply and notification templates to each form in Form Builder.
- **Enquiries:** inspect every submitted field, search, update status, add internal notes, send a configured template or write a manual email reply. Enquiry data is stored before email delivery is attempted.
- **Leads:** convert an enquiry once into a lead, then update pipeline stage, owner and estimated value.
- **Service packages:** create reusable package line items, currency and tax rate; insert an active package into a quotation or invoice draft.
- **Quotations & invoices:** create manually or from an enquiry, edit customer details, lines, currency, tax, dates and terms, download a branded PDF, email the PDF and update payment status. The API recalculates line totals, subtotal, tax and total on save rather than trusting totals posted by the browser. Document numbers use an atomic sequence counter.
- **Email setup:** configure SMTP and send a test email. The SMTP password is encrypted at rest in MongoDB.
- **Profile & company settings:** update the signed-in admin profile, company identity, invoice/quotation prefixes, currency and default tax rate.
- **Team users:** the owner can create admin/editor accounts and change their active status or role. Passwords are hashed with bcrypt and never shown again after creation.

Form auto-replies and internal notifications only send when the selected templates are enabled and valid SMTP settings have been configured. Template From addresses must match the verified sender address stored in SMTP settings, to avoid spoofing and provider rejections.

## 6. Deploy to Vercel (two projects)

The frontend and Express API deploy separately. This keeps the Next.js build and Express serverless API concerns isolated.

### Frontend project

1. Push this folder to a GitHub repository.
2. In Vercel, import the repository.
3. Set **Root Directory** to `web`.
4. Framework preset: Next.js. Build command and output directory can use Vercel defaults.
5. Set environment variables:
   - `NEXT_PUBLIC_API_URL=https://YOUR-API-DOMAIN/api`
   - `SITE_URL=https://YOUR-WEBSITE-DOMAIN`
6. Deploy.

### Express API project

1. Create a second Vercel project from the same Git repository.
2. Set **Root Directory** to `server`.
3. Vercel detects the exported Express application in `server/index.js` and deploys it as a Function. The Express app keeps its `/api/...` routes.
4. Add environment variables from the root `.env.example`: `NODE_ENV=production`, `WEB_ORIGIN=https://YOUR-WEBSITE-DOMAIN`, `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (initial seed only), `JWT_SECRET`, `JWT_EXPIRES_IN`, `COOKIE_NAME`, `EMAIL_ENCRYPTION_KEY`, plus company defaults if needed.
5. Deploy and test `https://YOUR-API-DOMAIN/api/health`.
6. Add the API origin to `WEB_ORIGIN` exactly, with no trailing slash. For multiple approved frontends, use comma-separated exact origins.
7. Set the frontend `NEXT_PUBLIC_API_URL` to the API production URL followed by `/api`, redeploy the frontend and test login/enquiry/email/PDF routes.

Use a custom website domain and API subdomain where possible (for example `www.example.com` and `api.example.com`). Admin cookies are HTTP-only and `SameSite=None; Secure` in production to support the separately deployed frontend and API. The API checks allowed origins for state-changing admin requests. Keep both deployments on HTTPS.

Vercel configuration and platform behavior can change. Check the current official Vercel documentation before production deployment:
- Next.js: https://vercel.com/docs/frameworks/nextjs
- Express: https://vercel.com/docs/frameworks/backend/express
- Environment variables: https://vercel.com/docs/environment-variables

## 7. Testing checklist before launch

This environment could not download npm packages at the time this project was assembled (npm registry returned a DNS `EAI_AGAIN` failure). The server JavaScript files passed Node syntax checks, but a full dependency install, Next.js production build, browser tests, MongoDB integration tests and live SMTP delivery test still need to be run in your local environment.

After `npm install` succeeds and `.env` is configured, run:

```powershell
npm run lint
npm run build
```

Then test this checklist manually with a test customer address and non-production database:

1. `/` and each supplied route load on desktop and mobile.
2. Create, edit, reorder, hide, publish and unpublish a CMS page; confirm navigation and frontend output update without a code change.
3. Add a `form` section to a page and confirm an unassigned form cannot be loaded/submitted from a different page.
4. Change Contact page content, select a different form, add a branch, and verify the visibility switches update the public page.
5. Submit valid and invalid form data; confirm required-field validation and that a valid enquiry is saved in MongoDB.
6. Enable a form's auto-reply and notification templates, test their variables and section order, and verify messages reach the test addresses.
7. Test SMTP configuration and manual admin replies; ensure From email matches the SMTP sender.
8. Convert an enquiry to a lead; confirm it appears once in the Leads pipeline.
9. Create a package and verify it persists after refresh; insert it into a quotation/invoice.
10. Create a quotation from an enquiry, edit line items, verify server totals, download PDF and email it.
11. Create an invoice manually, download PDF, email it and update payment status.
12. Change admin profile/password and verify the old password no longer works; create an editor and confirm owner-only screens are unavailable to them.
13. Try unauthenticated admin API requests and an unapproved Origin; both must be rejected.
14. Test MongoDB and email-provider failure states; user-facing messages should not reveal credentials or stack traces.

The provided project is a functional implementation foundation, not a claim that live email, MongoDB credentials or Vercel deployment have been verified in your accounts. Perform this launch checklist before collecting real customer information.

### Browser-extension hydration warning

If the browser console reports a root `<html>` attribute mismatch involving `webcrx` or `webcrx-bridged`, those attributes are being injected by a browser extension before React hydrates. The root layout includes `suppressHydrationWarning` on `<html>` to suppress this known external-attribute warning only. To verify the source, open the site in an Incognito window with extensions disabled, or disable the extension that injects those attributes. Do not add `suppressHydrationWarning` to the entire page or use client-only rendering as a workaround.

## Frontend visual refinement — November 2026

The current frontend stylesheet was refined to follow the supplied FSG reference screenshots more closely:

- Increased the public-site typography scale for navigation, hero copy, section headings, cards, FAQs, contact forms, CTA bands and footer text.
- Rebalanced the desktop hero to a 50/50 split between the dark-green copy panel and the photographic panel.
- Increased hero height and content spacing to match the reference banner proportions.
- Added explicit responsive rules for laptop, tablet, mobile and narrow 360px screens, including a horizontally scrollable mobile navigation and stacked hero layout.
- Improved touch target sizes and keyboard focus visibility, and added reduced-motion handling.
- Kept the existing admin UI, dynamic pages, forms and CMS class names intact while increasing admin control readability.

Updated files:

- `web/app/globals.css`
- `web/app/layout.jsx` (root hydration-warning guards on both `html` and `body`)

The reference URL could not be retrieved from this environment during this update, so the supplied full-page screenshots were used as the visual specification. A production browser test still requires installing the project dependencies and running it locally.


## Uploaded FSG image assets

See `source-assets/ASSET-MAP.md` for the mapping of your uploaded high-resolution hero photos and partner logos to public website assets. Original uploads are retained in `source-assets/`; optimized WebP assets are in `web/public/images/`.
#   f s g - e n v i r o n m e n t a l  
 