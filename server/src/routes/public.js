import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { Branch, ContactSettings, ContentPage, FormDefinition, FormSubmission, EmailTemplate, SiteSettings } from '../models/index.js';
import { sendTemplateEmail } from '../utils/email.js';

const router = Router();
router.get('/health', (_req, res) => res.json({ ok: true, service: 'fsg-api' }));
router.get('/site-index', async (_req, res, next) => {
  try { const pages = await ContentPage.find({ status: 'published' }).select('slug updatedAt seo').lean(); res.json({ pages }); }
  catch (error) { next(error); }
});
router.get('/pages/:slug', async (req, res, next) => {
  try {
    const page = await ContentPage.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' }).lean();
    if (!page) return res.status(404).json({ message: 'Page not found.' });
    res.json({ page });
  } catch (error) { next(error); }
});
router.get('/service-pages', async (_req, res, next) => {
  try { const items = await ContentPage.find({ pageType: 'service', status: 'published' }).select('slug title navLabel sections sortOrder').sort({ sortOrder: 1, title: 1 }).lean(); res.json({ items }); }
  catch (error) { next(error); }
});
router.get('/navigation', async (_req, res, next) => {
  try { const pages = await ContentPage.find({ status: 'published', showInNavigation: true }).select('slug title navLabel sortOrder').sort({ sortOrder: 1 }).lean(); res.json({ pages }); }
  catch (error) { next(error); }
});
router.get('/contact', async (_req, res, next) => {
  try {
    const [contact, branches, forms] = await Promise.all([
      ContactSettings.findOne({ key: 'primary' }).lean(),
      Branch.find({ visible: true, showOnContact: true }).sort({ sortOrder: 1 }).lean(),
      FormDefinition.find({ status: 'published' }).select('name slug description submitLabel successMessage layout fields pageSlugs placement').lean()
    ]);
    res.json({ contact: contact || {}, branches: contact?.showBranches === false ? [] : branches, forms, defaultFormSlug: contact?.defaultFormSlug || 'project-scope' });
  } catch (error) { next(error); }
});
router.get('/forms/:slug', async (req, res, next) => {
  try {
    const form = await FormDefinition.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' }).select('name slug description submitLabel successMessage layout fields pageSlugs').lean();
    if (!form) return res.status(404).json({ message: 'This form is not available.' });
    const requestedPage = String(req.query.page || '').trim().toLowerCase();
    if (form.pageSlugs?.length && (!requestedPage || !form.pageSlugs.includes(requestedPage))) return res.status(404).json({ message: 'This form is not assigned to this page.' });
    res.json({ form });
  } catch (error) { next(error); }
});

function normalizeSubmission(form, input) {
  const submitted = input?.fields && typeof input.fields === 'object' ? input.fields : {};
  const clean = {};
  for (const field of form.fields || []) {
    const raw = submitted[field.key];
    const value = field.type === 'checkbox' ? Boolean(raw) : Array.isArray(raw) ? raw.map(String).slice(0, 30) : String(raw ?? '').trim().slice(0, 5000);
    if (field.required && (field.type === 'checkbox' ? !value : !value || (Array.isArray(value) && !value.length))) throw new Error(`${field.label || field.key} is required.`);
    if (field.type === 'checkbox' ? value : value) clean[field.key] = value;
  }
  const fields = form.fields || [];
  const byKey = (k) => clean[k] || '';
  const byType = (type) => { const field = fields.find(f => f.type === type && clean[f.key]); return field ? clean[field.key] : ''; };
  const emailField = fields.find(f => (f.type === 'email' || /email/i.test(f.key)) && clean[f.key]);
  const email = byKey('email') || (emailField ? String(clean[emailField.key]) : '');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  const nameField = fields.find(f => /name/i.test(f.key) && !/company/i.test(f.key) && clean[f.key]);
  const phoneField = fields.find(f => (f.type === 'tel' || /phone|mobile/i.test(f.key)) && clean[f.key]);
  const serviceField = fields.find(f => /service/i.test(`${f.key} ${f.label}`) && clean[f.key]);
  const companyField = fields.find(f => /company|organization/i.test(`${f.key} ${f.label}`) && clean[f.key]);
  return {
    fields: clean, name: byKey('name') || byKey('fullName') || (nameField ? clean[nameField.key] : ''),
    email, phone: byKey('phone') || (phoneField ? clean[phoneField.key] : ''),
    company: byKey('company') || (companyField ? clean[companyField.key] : ''),
    service: byKey('service') || byKey('serviceNeeded') || (serviceField ? clean[serviceField.key] : '')
  };
}

router.post('/forms/:slug/submit', async (req, res, next) => {
  try {
    const form = await FormDefinition.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' });
    if (!form) return res.status(404).json({ message: 'This form is not available.' });
    const normalized = normalizeSubmission(form, req.body || {});
    const pageSlug = String(req.body?.pageSlug || '').trim().toLowerCase().slice(0, 100);
    if (form.pageSlugs?.length && !form.pageSlugs.includes(pageSlug)) return res.status(403).json({ message: 'This form is not assigned to the submitted page.' });
    const reference = `FSG-${new Date().getFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`;
    const submission = await FormSubmission.create({ ...normalized, formId: form._id, formName: form.name, formSlug: form.slug, pageSlug, reference, fields: normalized.fields });
    const siteSettings = await SiteSettings.findOne({ key: 'primary' }).lean();
    const variables = {
      customer: { name: normalized.name, email: normalized.email, phone: normalized.phone, company: normalized.company, service: normalized.service },
      form: { name: form.name, slug: form.slug }, submission: { id: reference, createdAt: submission.createdAt?.toISOString?.() || new Date().toISOString() }, fields: normalized.fields,
      company: { name: siteSettings?.companyName || process.env.COMPANY_NAME || 'FSG Environmental', notificationEmail: siteSettings?.smtp?.notificationTo || siteSettings?.smtp?.fromEmail || '' }
    };
    const sent = [];
    for (const templateId of [...new Set([form.autoReplyTemplateId, form.notificationTemplateId].filter(Boolean).map(String))]) {
      try {
        const template = await EmailTemplate.findById(templateId).lean();
        if (!template?.enabled) continue;
        const result = await sendTemplateEmail(template, variables, {});
        sent.push({ templateName: template.name, to: result.to, subject: result.subject, status: 'sent', sentAt: new Date() });
      } catch (mailError) {
        sent.push({ templateName: 'Configured form email', status: 'failed', error: mailError.message });
      }
    }
    if (sent.length) { submission.emailHistory.push(...sent); await submission.save(); }
    res.status(201).json({ success: true, reference, message: form.successMessage, emailStatus: sent.map(({ templateName, status }) => ({ templateName, status })) });
  } catch (error) {
    if (error.message?.includes('required') || error.message?.includes('valid email')) return res.status(422).json({ message: error.message });
    next(error);
  }
});

export default router;
