import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AdminUser, Branch, BusinessDocument, ContactSettings, ContentPage, EmailTemplate, FormDefinition, FormSubmission, Lead, ServicePackage, SiteSettings } from '../models/index.js';
import { requireAdmin, ownerOnly } from '../middleware/auth.js';
import { encryptSecret } from '../utils/crypto.js';
import { getTransport, sendTemplateEmail } from '../utils/email.js';
import { buildBusinessPdf } from '../utils/document.js';

const router = Router();
const cookieName = process.env.COOKIE_NAME || 'fsg_admin_session';
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 };

router.post('/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase(); const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    const user = await AdminUser.findOne({ email });
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    user.lastLoginAt = new Date(); await user.save();
    const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.cookie(cookieName, token, cookieOptions).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) { next(error); }
});
router.post('/auth/logout', (_req, res) => res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined }).json({ success: true }));
router.get('/auth/me', requireAdmin, (req, res) => res.json({ user: { id: req.admin._id, name: req.admin.name, email: req.admin.email, role: req.admin.role } }));
router.use(requireAdmin);

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [enquiries, leads, pages, branches, forms, packages, quotations, invoices] = await Promise.all([
      FormSubmission.countDocuments(), Lead.countDocuments(), ContentPage.countDocuments(), Branch.countDocuments(), FormDefinition.countDocuments(), ServicePackage.countDocuments(),
      BusinessDocument.countDocuments({ type: 'quotation' }), BusinessDocument.countDocuments({ type: 'invoice' })
    ]);
    res.json({ counts: { enquiries, leads, pages, branches, forms, packages, quotations, invoices } });
  } catch (error) { next(error); }
});

function crudRoutes(path, Model, { sort = { updatedAt: -1 }, select } = {}) {
  router.get(`/${path}`, async (_req, res, next) => { try { let q = Model.find().sort(sort); if (select) q = q.select(select); res.json({ items: await q.lean() }); } catch (e) { next(e); } });
  router.post(`/${path}`, async (req, res, next) => { try { const doc = await Model.create(req.body || {}); res.status(201).json({ item: doc }); } catch (e) { next(e); } });
  router.put(`/${path}/:id`, async (req, res, next) => { try { const patch = { ...(req.body || {}) }; delete patch._id; delete patch.createdAt; delete patch.updatedAt; const item = await Model.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: 'Record not found.' }); res.json({ item }); } catch (e) { next(e); } });
  router.delete(`/${path}/:id`, async (req, res, next) => { try { const item = await Model.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ message: 'Record not found.' }); res.json({ success: true }); } catch (e) { next(e); } });
}

crudRoutes('pages', ContentPage, { sort: { sortOrder: 1, title: 1 } });
crudRoutes('branches', Branch, { sort: { sortOrder: 1, name: 1 } });
crudRoutes('forms', FormDefinition, { sort: { updatedAt: -1 } });
crudRoutes('email-templates', EmailTemplate, { sort: { purpose: 1, name: 1 } });
crudRoutes('packages', ServicePackage, { sort: { name: 1 } });

router.get('/contact-settings', async (_req, res, next) => { try { res.json({ item: await ContactSettings.findOneAndUpdate({ key: 'primary' }, { $setOnInsert: { key: 'primary' } }, { upsert: true, new: true }).lean() }); } catch (e) { next(e); } });
router.put('/contact-settings', async (req, res, next) => { try { const patch = { ...(req.body || {}) }; delete patch._id; delete patch.key; delete patch.createdAt; delete patch.updatedAt; const item = await ContactSettings.findOneAndUpdate({ key: 'primary' }, { $set: patch }, { upsert: true, new: true, runValidators: true }); res.json({ item }); } catch (e) { next(e); } });

router.get('/settings', async (_req, res, next) => { try { const item = await SiteSettings.findOne({ key: 'primary' }).lean() || {}; if (item.smtp) item.smtp = { ...item.smtp, passwordCipher: item.smtp.passwordCipher ? '••••••••' : '' }; res.json({ item }); } catch (e) { next(e); } });
router.put('/settings', async (req, res, next) => {
  try {
    const patch = { ...(req.body || {}) }; delete patch._id; delete patch.key; delete patch.smtp;
    const item = await SiteSettings.findOneAndUpdate({ key: 'primary' }, { $set: patch }, { upsert: true, new: true, runValidators: true });
    res.json({ item });
  } catch (e) { next(e); }
});
router.put('/email-settings', async (req, res, next) => {
  try {
    const input = req.body?.smtp || {}; const current = await SiteSettings.findOne({ key: 'primary' }) || new SiteSettings({ key: 'primary' });
    current.smtp = { ...(current.smtp?.toObject?.() || current.smtp || {}), host: String(input.host || '').trim(), port: Number(input.port || 587), secure: Boolean(input.secure), user: String(input.user || '').trim(), passwordCipher: input.password ? encryptSecret(String(input.password)) : current.smtp?.passwordCipher || '', fromName: String(input.fromName || '').trim(), fromEmail: String(input.fromEmail || '').trim(), notificationTo: String(input.notificationTo || '').trim(), replyTo: String(input.replyTo || '').trim() };
    await current.save(); res.json({ success: true, configured: Boolean(current.smtp.host && current.smtp.user && current.smtp.passwordCipher) });
  } catch (e) { next(e); }
});
router.post('/email-settings/test', async (req, res, next) => {
  try { const { transport, defaults } = await getTransport(); const to = String(req.body?.to || defaults.notificationTo); if (!to) return res.status(400).json({ message: 'Enter a test recipient email address.' }); await transport.sendMail({ from: defaults.from, to, replyTo: defaults.replyTo, subject: 'FSG Environmental email configuration test', text: 'Your FSG Environmental SMTP configuration is working.' }); res.json({ success: true }); }
  catch (e) { next(e); }
});

router.get('/enquiries', async (req, res, next) => {
  try { const q = String(req.query.q || '').trim().slice(0, 100); const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const filter = q ? { $or: [{ name: new RegExp(safe, 'i') }, { email: new RegExp(safe, 'i') }, { reference: new RegExp(safe, 'i') }, { company: new RegExp(safe, 'i') }] } : {}; res.json({ items: await FormSubmission.find(filter).sort({ createdAt: -1 }).limit(300).lean() }); }
  catch (e) { next(e); }
});
router.get('/enquiries/:id', async (req, res, next) => { try { const item = await FormSubmission.findById(req.params.id).lean(); if (!item) return res.status(404).json({ message: 'Enquiry not found.' }); res.json({ item }); } catch (e) { next(e); } });
router.put('/enquiries/:id', async (req, res, next) => { try { const patch = {}; for (const k of ['status', 'notes']) if (k in req.body) patch[k] = req.body[k]; const item = await FormSubmission.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: 'Enquiry not found.' }); res.json({ item }); } catch (e) { next(e); } });
router.post('/enquiries/:id/convert-lead', async (req, res, next) => {
  try {
    const enquiry = await FormSubmission.findById(req.params.id); if (!enquiry) return res.status(404).json({ message: 'Enquiry not found.' });
    if (enquiry.leadId) return res.status(409).json({ message: 'This enquiry is already converted to a lead.', leadId: enquiry.leadId });
    const lead = await Lead.create({ enquiryId: enquiry._id, name: enquiry.name, email: enquiry.email, phone: enquiry.phone, company: enquiry.company, service: enquiry.service, source: enquiry.formName || 'Website enquiry' });
    enquiry.leadId = lead._id; enquiry.status = 'converted'; await enquiry.save(); res.status(201).json({ item: lead });
  } catch (e) { next(e); }
});
router.post('/enquiries/:id/create-quotation', async (req, res, next) => {
  try {
    const enquiry = await FormSubmission.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ message: 'Enquiry not found.' });
    const number = await allocateDocumentNumber('quotation');
    const settings = await SiteSettings.findOne({ key: 'primary' }).lean() || {};
    const item = await BusinessDocument.create({
      number, type: 'quotation', enquiryId: enquiry._id, leadId: enquiry.leadId,
      customer: { name: enquiry.name, email: enquiry.email, company: enquiry.company, phone: enquiry.phone, address: enquiry.fields?.siteLocation || '' },
      currency: settings.currency || 'GBP', taxRate: settings.taxRate ?? 20, items: [{ description: `Initial scope review — ${enquiry.service || enquiry.formName || 'Environmental services'}`, quantity: 1, unitPrice: 0, total: 0 }],
      subtotal: 0, tax: 0, total: 0, status: 'draft', notes: `Prepared from enquiry ${enquiry.reference}. Review the site scope and enter agreed pricing before sending.`
    });
    res.status(201).json({ item });
  } catch (e) { next(e); }
});

router.post('/enquiries/:id/send-template', async (req, res, next) => {
  try {
    const enquiry = await FormSubmission.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ message: 'Enquiry not found.' });
    const template = await EmailTemplate.findById(req.body?.templateId).lean();
    if (!template) return res.status(404).json({ message: 'Email template not found.' });
    const siteSettings = await SiteSettings.findOne({ key: 'primary' }).lean();
    const variables = {
      customer: { name: enquiry.name, email: enquiry.email, phone: enquiry.phone, company: enquiry.company, service: enquiry.service },
      form: { name: enquiry.formName, slug: enquiry.formSlug },
      submission: { id: enquiry.reference, createdAt: enquiry.createdAt?.toISOString?.() || '' },
      fields: enquiry.fields || {},
      company: { name: siteSettings?.companyName || 'FSG Environmental', notificationEmail: siteSettings?.smtp?.notificationTo || siteSettings?.smtp?.fromEmail || '' }
    };
    const result = await sendTemplateEmail(template, variables, { to: req.body?.to || undefined });
    enquiry.emailHistory.push({ templateName: template.name, to: result.to, subject: result.subject, status: 'sent', sentAt: new Date() });
    enquiry.status = 'replied'; await enquiry.save();
    res.json({ success: true, to: result.to, subject: result.subject });
  } catch (e) { next(e); }
});

router.post('/enquiries/:id/send-email', async (req, res, next) => {
  try {
    const enquiry = await FormSubmission.findById(req.params.id); if (!enquiry) return res.status(404).json({ message: 'Enquiry not found.' });
    const to = String(req.body?.to || enquiry.email || '').trim(); const subject = String(req.body?.subject || '').replace(/[\r\n]+/g, ' ').trim(); const body = String(req.body?.message || '').trim();
    if (!to || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) return res.status(422).json({ message: 'Enter a valid To email address.' });
    if (!subject || !body) return res.status(422).json({ message: 'Subject and message are required.' });
    const { transport, defaults } = await getTransport();
    const safeBody = body.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])).replace(/\n/g, '<br>');
    const requestedFrom = String(req.body?.fromEmail || defaults.from.address).trim();
    if (requestedFrom.toLowerCase() !== defaults.from.address.toLowerCase()) return res.status(422).json({ message: 'The From address must match the verified sender configured in SMTP settings.' });
    const fromName = String(req.body?.fromName || defaults.from.name).replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
    await transport.sendMail({ from: { name: fromName, address: defaults.from.address }, to, replyTo: defaults.replyTo, subject, html: `<div style="font-family:Arial,sans-serif;line-height:1.6">${safeBody}</div>` });
    enquiry.emailHistory.push({ templateName: 'Manual admin reply', to, subject, status: 'sent', sentAt: new Date() }); enquiry.status = 'replied'; await enquiry.save(); res.json({ success: true });
  } catch (e) { next(e); }
});
router.get('/leads', async (_req, res, next) => { try { res.json({ items: await Lead.find().sort({ updatedAt: -1 }).lean() }); } catch (e) { next(e); } });
router.put('/leads/:id', async (req, res, next) => { try { const patch = {}; for (const k of ['stage', 'owner', 'value', 'notes']) if (k in req.body) patch[k] = req.body[k]; const item = await Lead.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: 'Lead not found.' }); res.json({ item }); } catch (e) { next(e); } });

function calculateDocument(body, type) {
  const items = (body.items || []).map(i => { const quantity = Math.max(0, Number(i.quantity || 0)); const unitPrice = Math.max(0, Number(i.unitPrice || 0)); return { description: String(i.description || '').slice(0, 500), quantity, unitPrice, total: quantity * unitPrice }; });
  const subtotal = items.reduce((sum, i) => sum + i.total, 0); const taxRate = Math.max(0, Math.min(100, Number(body.taxRate || 0))); const tax = subtotal * taxRate / 100;
  return { ...body, type, items, subtotal, taxRate, tax, total: subtotal + tax };
}
async function allocateDocumentNumber(type) {
  const field = type === 'invoice' ? 'nextInvoiceNumber' : 'nextQuoteNumber';
  const fallbackPrefix = type === 'invoice' ? 'FSG-I' : 'FSG-Q';
  // The $inc is atomic, so two admins creating documents at the same time
  // cannot receive the same sequence number.
  await SiteSettings.updateOne({ key: 'primary' }, { $setOnInsert: { key: 'primary', nextInvoiceNumber: 1001, nextQuoteNumber: 1001 } }, { upsert: true });
  await SiteSettings.updateOne({ key: 'primary', [field]: { $exists: false } }, { $set: { [field]: 1001 } });
  const before = await SiteSettings.findOneAndUpdate({ key: 'primary' }, { $inc: { [field]: 1 } }, { new: false });
  const settings = before || await SiteSettings.findOne({ key: 'primary' }).lean() || {};
  const counter = Number(settings[field] || 1001);
  const prefix = type === 'invoice' ? (settings.invoicePrefix || fallbackPrefix) : (settings.quotePrefix || fallbackPrefix);
  return `${prefix}-${counter}`;
}
router.get('/documents', async (req, res, next) => { try { const filter = req.query.type ? { type: req.query.type } : {}; res.json({ items: await BusinessDocument.find(filter).sort({ createdAt: -1 }).lean() }); } catch (e) { next(e); } });
router.post('/documents', async (req, res, next) => {
  try { const type = req.body?.type === 'invoice' ? 'invoice' : 'quotation'; const number = req.body?.number || await allocateDocumentNumber(type); const data = calculateDocument(req.body || {}, type); const item = await BusinessDocument.create({ ...data, number }); res.status(201).json({ item }); }
  catch (e) { next(e); }
});
router.put('/documents/:id', async (req, res, next) => { try { const existing = await BusinessDocument.findById(req.params.id); if (!existing) return res.status(404).json({ message: 'Document not found.' }); const data = calculateDocument({ ...existing.toObject(), ...(req.body || {}) }, existing.type); delete data._id; delete data.createdAt; delete data.updatedAt; const item = await BusinessDocument.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true }); res.json({ item }); } catch (e) { next(e); } });
router.get('/documents/:id/pdf', async (req, res, next) => { try { const item = await BusinessDocument.findById(req.params.id).lean(); if (!item) return res.status(404).json({ message: 'Document not found.' }); const settings = await SiteSettings.findOne({ key: 'primary' }).lean() || {}; const buffer = await buildBusinessPdf(item, settings); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${item.number}.pdf"`); res.send(buffer); } catch (e) { next(e); } });

router.post('/documents/:id/send-email', async (req, res, next) => {
  try {
    const item = await BusinessDocument.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Document not found.' });
    const to = String(req.body?.to || item.customer?.email || '').trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(422).json({ message: 'Enter a valid recipient email address.' });
    const { transport, defaults } = await getTransport();
    const settings = await SiteSettings.findOne({ key: 'primary' }).lean() || {};
    const buffer = await buildBusinessPdf(item.toObject(), settings);
    const title = item.type === 'invoice' ? 'Invoice' : 'Quotation';
    const safeName = String(item.customer?.name || '').replace(/[&<>"']/g, '');
    await transport.sendMail({
      from: defaults.from, to, replyTo: defaults.replyTo,
      subject: `${title} ${item.number} from ${settings.companyName || 'FSG Environmental'}`,
      html: `<p>Hello ${safeName},</p><p>Please find attached ${title.toLowerCase()} <strong>${item.number}</strong>.</p><p>Thank you,<br>${settings.companyName || 'FSG Environmental'}</p>`,
      attachments: [{ filename: `${item.number}.pdf`, content: buffer, contentType: 'application/pdf' }]
    });
    item.sentTo = to; item.sentAt = new Date(); item.emailStatus = 'sent'; item.status = 'sent'; await item.save();
    res.json({ success: true, to, sentAt: item.sentAt });
  } catch (e) { next(e); }
});

router.put('/profile', async (req, res, next) => {
  try {
    const user = await AdminUser.findById(req.admin._id); const { name, email, currentPassword, newPassword } = req.body || {};
    const nextEmail = String(email || user.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) return res.status(422).json({ message: 'Enter a valid login email address.' });
    const changingCredentials = Boolean(newPassword || nextEmail !== user.email);
    if (changingCredentials && (!currentPassword || !(await bcrypt.compare(String(currentPassword), user.passwordHash)))) return res.status(403).json({ message: 'Current password is required and must be correct to change login credentials.' });
    user.email = nextEmail;
    if (name) user.name = String(name).trim().slice(0, 120);
    if (newPassword) { if (String(newPassword).length < 12) return res.status(422).json({ message: 'New password must be at least 12 characters.' }); user.passwordHash = await bcrypt.hash(String(newPassword), 12); }
    await user.save(); if (changingCredentials) res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined }); res.json({ success: true, user: { name: user.name, email: user.email }, sessionRevoked: changingCredentials });
  } catch (e) { next(e); }
});
router.get('/users', ownerOnly, async (_req, res, next) => {
  try { res.json({ items: await AdminUser.find().select('-passwordHash').sort({ createdAt: 1 }).lean() }); }
  catch (e) { next(e); }
});
router.post('/users', ownerOnly, async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !password || String(password).length < 12) return res.status(422).json({ message: 'A valid email and a password with at least 12 characters are required.' });
    const user = await AdminUser.create({ name, email: normalizedEmail, passwordHash: await bcrypt.hash(String(password), 12), role: ['admin', 'editor'].includes(role) ? role : 'admin' });
    res.status(201).json({ item: { id: user._id, name: user.name, email: user.email, role: user.role, active: user.active } });
  } catch (e) { next(e); }
});
router.put('/users/:id', ownerOnly, async (req, res, next) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (String(user._id) === String(req.admin._id) && req.body?.active === false) return res.status(422).json({ message: 'You cannot deactivate your own account.' });
    if (req.body?.name !== undefined) user.name = String(req.body.name).trim().slice(0, 120);
    if (req.body?.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(422).json({ message: 'Enter a valid email address.' });
      user.email = email;
    }
    if (['admin', 'editor'].includes(req.body?.role)) user.role = req.body.role;
    if (typeof req.body?.active === 'boolean') user.active = req.body.active;
    await user.save();
    res.json({ item: { id: user._id, name: user.name, email: user.email, role: user.role, active: user.active } });
  } catch (e) { next(e); }
});

router.get('/email-templates/:id/preview', async (req, res, next) => { try { const item = await EmailTemplate.findById(req.params.id).lean(); if (!item) return res.status(404).json({ message: 'Template not found.' }); res.json({ html: [item.headerHtml, item.bodyHtml, item.footerHtml].filter(Boolean).join('\n') }); } catch (e) { next(e); } });
router.post('/email-templates/:id/test', async (req, res, next) => { try { const template = await EmailTemplate.findById(req.params.id).lean(); if (!template) return res.status(404).json({ message: 'Template not found.' }); const to = String(req.body?.to || '').trim(); if (!to) return res.status(422).json({ message: 'Test recipient is required.' }); await sendTemplateEmail(template, { customer: { name: 'Example Customer', email: to, company: 'Example Company' }, form: { name: 'Example enquiry' }, submission: { id: 'FSG-TEST-0001' }, fields: { Service: 'Environmental Remediation' }, company: { name: 'FSG Environmental' } }, { to, force: true }); res.json({ success: true }); } catch (e) { next(e); } });

export default router;
