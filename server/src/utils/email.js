import nodemailer from 'nodemailer';
import { SiteSettings } from '../models/index.js';
import { decryptSecret } from './crypto.js';

export async function getTransport() {
  const settings = await SiteSettings.findOne({ key: 'primary' }).lean();
  const smtp = settings?.smtp || {};
  if (!smtp.host || !smtp.user || !smtp.passwordCipher) throw new Error('Email is not configured. Set up SMTP in Admin → Email & Forms.');
  const password = decryptSecret(smtp.passwordCipher);
  return {
    transport: nodemailer.createTransport({ host: smtp.host, port: Number(smtp.port || 587), secure: Boolean(smtp.secure), auth: { user: smtp.user, pass: password } }),
    defaults: { from: { name: smtp.fromName || settings?.companyName || 'FSG Environmental', address: smtp.fromEmail || smtp.user }, replyTo: smtp.replyTo || smtp.fromEmail || smtp.user, notificationTo: smtp.notificationTo || smtp.fromEmail || smtp.user }
  };
}


function normalizeAddresses(value, label, { required = false } = {}) {
  const entries = String(value || '').split(/[;,]/).map(v => v.trim()).filter(Boolean);
  if (required && entries.length === 0) throw new Error(`${label} is required.`);
  if (entries.some(entry => !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(entry))) throw new Error(`${label} contains an invalid email address.`);
  return entries.join(', ');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function interpolate(template = '', variables = {}) {
  return String(template).replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, key) => {
    const value = key.split('.').reduce((obj, part) => obj == null ? undefined : obj[part], variables);
    return escapeHtml(value ?? '');
  });
}

export function composeTemplate(template, variables) {
  const header = interpolate(template.headerHtml, variables);
  const body = interpolate(template.bodyHtml, variables);
  const footer = interpolate(template.footerHtml, variables);
  const parts = { header: `<tr><td style="padding:28px 32px;background:#0e2118;color:#fff">${header}</td></tr>`, body: `<tr><td style="padding:32px">${body}</td></tr>`, footer: `<tr><td style="padding:22px 32px;background:#edf2ec;color:#516258;font-size:12px">${footer}</td></tr>` };
  const order = Array.isArray(template.layoutOrder) && template.layoutOrder.length ? template.layoutOrder : ['header','body','footer'];
  const content = order.map(name => parts[name]).filter(Boolean).join('');
  return `<!doctype html><html><body style="margin:0;background:#f4f6f2;font-family:Arial,sans-serif;color:#17211a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f2;padding:28px 10px"><tr><td align="center"><table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#fff">${content}</table></td></tr></table></body></html>`;
}

export async function sendTemplateEmail(template, variables, overrides = {}) {
  if (!template?.enabled && !overrides.force) throw new Error('This email template is disabled.');
  const { transport, defaults } = await getTransport();
  const to = normalizeAddresses(overrides.to || interpolate(template.to || '{{customer.email}}', variables), 'To', { required: true });
  const cc = normalizeAddresses(overrides.cc || (template.cc ? interpolate(template.cc, variables) : ''), 'CC');
  const bcc = normalizeAddresses(overrides.bcc || (template.bcc ? interpolate(template.bcc, variables) : ''), 'BCC');
  const subject = interpolate(template.subject || 'Message from FSG Environmental', variables).replace(/[\r\n]+/g, ' ').trim();
  if (!subject) throw new Error('Email subject is required.');
  const fromName = template.fromName || defaults.from.name;
  const fromEmail = template.fromEmail || defaults.from.address;
  if (fromEmail.toLowerCase() !== defaults.from.address.toLowerCase()) throw new Error('The template From email must match the verified sender configured in SMTP settings.');
  const html = composeTemplate(template, variables);
  const info = await transport.sendMail({
    from: { name: String(fromName).replace(/[\r\n]+/g, ' ').trim(), address: fromEmail }, to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    replyTo: template.replyTo || defaults.replyTo,
    subject, html, text: `${subject}\n\n${String(template.bodyHtml || '').replace(/<[^>]+>/g, ' ')}`
  });
  return { messageId: info.messageId, to, subject };
}
