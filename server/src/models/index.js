import mongoose from 'mongoose';
const { Schema, model, models } = mongoose;

const AdminUserSchema = new Schema({
  name: { type: String, default: 'Administrator', trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['owner', 'admin', 'editor'], default: 'owner' },
  active: { type: Boolean, default: true },
  lastLoginAt: Date
}, { timestamps: true });

const ContentPageSchema = new Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^(?!admin$|contact$|robots$|sitemap$)[a-z0-9-]+$/ },
  title: { type: String, required: true, trim: true }, navLabel: String,
  pageType: { type: String, default: 'standard' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  showInNavigation: { type: Boolean, default: false }, sortOrder: { type: Number, default: 0 },
  seo: { title: String, description: String, canonical: String, noIndex: { type: Boolean, default: false }, ogImage: String },
  sections: [{ id: String, type: String, label: String, visible: { type: Boolean, default: true }, data: Schema.Types.Mixed }],
  formSlug: String
}, { timestamps: true });

const BranchSchema = new Schema({
  name: { type: String, required: true, trim: true }, label: String,
  address: String, city: String, region: String, postalCode: String, country: { type: String, default: 'United Kingdom' },
  phone: String, email: String, mapUrl: String, openingHours: String,
  visible: { type: Boolean, default: true }, showOnContact: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const ContactSettingsSchema = new Schema({
  key: { type: String, default: 'primary', unique: true },
  eyebrow: String, title: String, intro: String, emergencyNotice: String,
  heroImage: String, heroButtonLabel: String, heroButtonHref: String, heroSecondaryLabel: String, heroSecondaryHref: String,
  formEyebrow: String, formTitle: String, formIntro: String,
  branchesEyebrow: String, branchesTitle: String, branchesIntro: String,
  incidentEyebrow: String, incidentTitle: String, incidentText: String,
  ctaEyebrow: String, ctaTitle: String, ctaText: String, ctaButtonLabel: String, ctaButtonHref: String,
  mainPhone: String, mainEmail: String, address: String,
  contactPageVisible: { type: Boolean, default: true },
  showBranches: { type: Boolean, default: true },
  defaultFormSlug: { type: String, default: 'project-scope' },
  seo: { title: String, description: String, canonical: String, noIndex: { type: Boolean, default: false }, ogImage: String },
  footerText: String, socials: [{ label: String, url: String, visible: Boolean }]
}, { timestamps: true });

const FormFieldSchema = new Schema({
  key: { type: String, required: true, trim: true, match: /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/ },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['text', 'email', 'tel', 'number', 'date', 'select', 'textarea', 'checkbox'], default: 'text' },
  placeholder: { type: String, maxlength: 240 },
  required: { type: Boolean, default: false },
  options: [String],
  width: { type: String, enum: ['half', 'full'], default: 'half' },
  order: { type: Number, default: 0 }
}, { _id: false });

const FormDefinitionSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]+$/ },
  description: String, submitLabel: { type: String, default: 'Send request' }, successMessage: { type: String, default: 'Thank you. Your request has been received.' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  pageSlugs: [{ type: String, lowercase: true, trim: true }], placement: { type: String, default: 'inline' },
  layout: { columns: { type: Number, min: 1, max: 3, default: 2 }, style: { type: String, default: 'reference' }, formBackground: { type: String, default: '#ffffff' }, fieldBackground: { type: String, default: '#fbfcfa' }, fieldBorderColor: { type: String, default: '#d7e0d6' }, accentColor: { type: String, default: '#238638' }, buttonBackground: { type: String, default: '#61d94e' }, buttonTextColor: { type: String, default: '#06170c' }, textColor: { type: String, default: '#101b16' }, borderRadius: { type: Number, min: 0, max: 16, default: 0 } },
  fields: { type: [FormFieldSchema], default: [], validate: { validator: (fields) => new Set(fields.map((field) => field.key)).size === fields.length, message: 'Form field keys must be unique.' } },
  autoReplyTemplateId: { type: Schema.Types.ObjectId, ref: 'EmailTemplate' },
  notificationTemplateId: { type: Schema.Types.ObjectId, ref: 'EmailTemplate' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' }
}, { timestamps: true });

const EmailTemplateSchema = new Schema({
  name: { type: String, required: true, trim: true },
  key: { type: String, required: true, unique: true, trim: true },
  purpose: { type: String, enum: ['auto-reply', 'admin-notification', 'manual-reply', 'quotation', 'invoice', 'custom'], default: 'custom' },
  trigger: { type: String, default: 'manual' }, enabled: { type: Boolean, default: true },
  to: { type: String, default: '{{customer.email}}' }, cc: String, bcc: String,
  fromName: String, fromEmail: String, replyTo: String,
  subject: { type: String, required: true },
  headerHtml: String, bodyHtml: String, footerHtml: String,
  attachmentMode: { type: String, enum: ['none', 'quotation', 'invoice'], default: 'none' },
  layoutOrder: { type: [String], enum: ['header', 'body', 'footer'], default: ['header', 'body', 'footer'] },
  formSlugs: [String]
}, { timestamps: true });

const FormSubmissionSchema = new Schema({
  formId: { type: Schema.Types.ObjectId, ref: 'FormDefinition' }, formName: String,
  formSlug: String, pageSlug: String, reference: { type: String, unique: true },
  name: String, email: String, phone: String, company: String, service: String,
  fields: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['new', 'reviewing', 'replied', 'converted', 'closed'], default: 'new' },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' }, notes: String,
  emailHistory: [{ templateName: String, to: String, subject: String, status: String, sentAt: Date, error: String }]
}, { timestamps: true });

const LeadSchema = new Schema({
  enquiryId: { type: Schema.Types.ObjectId, ref: 'FormSubmission' }, name: String, email: String, phone: String, company: String,
  service: String, source: String, stage: { type: String, default: 'new' }, value: { type: Number, default: 0 }, owner: String, notes: String
}, { timestamps: true });

const ServicePackageSchema = new Schema({
  name: { type: String, required: true }, code: String, description: String, currency: { type: String, default: 'GBP' },
  taxRate: { type: Number, default: 20 }, active: { type: Boolean, default: true },
  items: [{ description: String, quantity: { type: Number, default: 1 }, unitPrice: { type: Number, default: 0 } }]
}, { timestamps: true });

const DocumentSchema = new Schema({
  number: { type: String, required: true, unique: true }, type: { type: String, enum: ['quotation', 'invoice'], required: true },
  customer: { name: String, email: String, company: String, address: String, phone: String },
  enquiryId: { type: Schema.Types.ObjectId, ref: 'FormSubmission' }, leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  currency: { type: String, default: 'GBP' }, items: [{ description: String, quantity: Number, unitPrice: Number, total: Number }],
  subtotal: Number, taxRate: Number, tax: Number, total: Number, notes: String, terms: String,
  status: { type: String, default: 'draft' }, validUntil: Date, dueDate: Date, paidAt: Date, sentTo: String, sentAt: Date, emailStatus: String
}, { timestamps: true });

const SiteSettingsSchema = new Schema({
  key: { type: String, default: 'primary', unique: true }, companyName: String, logoUrl: String, website: String,
  phone: String, email: String, address: String, currency: { type: String, default: 'GBP' }, taxRate: { type: Number, default: 20 },
  quotePrefix: { type: String, default: 'FSG-Q' }, invoicePrefix: { type: String, default: 'FSG-I' }, nextQuoteNumber: { type: Number, default: 1001 }, nextInvoiceNumber: { type: Number, default: 1001 },
  smtp: { host: String, port: Number, secure: Boolean, user: String, passwordCipher: String, fromName: String, fromEmail: String, notificationTo: String, replyTo: String }
}, { timestamps: true });

export const AdminUser = models.AdminUser || model('AdminUser', AdminUserSchema);
export const ContentPage = models.ContentPage || model('ContentPage', ContentPageSchema);
export const Branch = models.Branch || model('Branch', BranchSchema);
export const ContactSettings = models.ContactSettings || model('ContactSettings', ContactSettingsSchema);
export const FormDefinition = models.FormDefinition || model('FormDefinition', FormDefinitionSchema);
export const EmailTemplate = models.EmailTemplate || model('EmailTemplate', EmailTemplateSchema);
export const FormSubmission = models.FormSubmission || model('FormSubmission', FormSubmissionSchema);
export const Lead = models.Lead || model('Lead', LeadSchema);
export const ServicePackage = models.ServicePackage || model('ServicePackage', ServicePackageSchema);
export const BusinessDocument = models.BusinessDocument || model('BusinessDocument', DocumentSchema);
export const SiteSettings = models.SiteSettings || model('SiteSettings', SiteSettingsSchema);
