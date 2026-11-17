'use client';
import { useEffect, useMemo, useState } from 'react';
const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export default function DynamicForm({ formSlug = 'project-scope', pageSlug = 'contact' }) {
 const [form, setForm] = useState(null); const [values, setValues] = useState({}); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [busy, setBusy] = useState(false);
 useEffect(() => { let active = true; setForm(null); setError(''); setSuccess(''); setValues({}); fetch(`${API}/forms/${encodeURIComponent(formSlug)}?page=${encodeURIComponent(pageSlug)}`).then(r => r.ok ? r.json() : Promise.reject(new Error('This form is not published yet.'))).then(d => { if(active) setForm(d.form); }).catch(e => { if(active) setError(e.message); }); return () => { active = false; }; }, [formSlug, pageSlug]);
 const fields = useMemo(() => [...(form?.fields || [])].sort((a,b)=>(a.order||0)-(b.order||0)), [form]);
 const setValue = (key, value) => setValues(old => ({ ...old, [key]: value }));
 async function submit(e) {
  e.preventDefault(); setError(''); setSuccess(''); setBusy(true);
  try {
   const response = await fetch(`${API}/forms/${encodeURIComponent(formSlug)}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: values, pageSlug }) });
   const result = await response.json(); if (!response.ok) throw new Error(result.message || 'The form could not be sent.');
   setSuccess(`${result.message || 'Thank you. Your request has been received.'} Reference: ${result.reference}`); setValues({});
  } catch (e) { setError(e.message); } finally { setBusy(false); }
 }
 if (error && !form) return <div className="form-notice error">{error}</div>;
 if (!form) return <div className="form-loading">Loading project brief…</div>;
 const theme = form.layout || {};
 const formStyle = { '--form-background': theme.formBackground || '#ffffff', '--form-field-background': theme.fieldBackground || '#fbfcfa', '--form-field-border': theme.fieldBorderColor || '#d7e0d6', '--form-accent': theme.accentColor || '#238638', '--form-button-background': theme.buttonBackground || '#61d94e', '--form-button-text': theme.buttonTextColor || '#06170c', '--form-text-color': theme.textColor || '#101b16', '--form-radius': `${Math.max(0, Math.min(16, Number(theme.borderRadius || 0)))}px` };
 return <div className="form-shell" style={formStyle}>
  {form.description && <p className="form-description">{form.description}</p>}
  {success ? <div className="form-notice success"><b>Request received.</b><p>{success}</p><button type="button" className="button button-green" onClick={()=>setSuccess('')}>Send another brief</button></div> : <form className="dynamic-form" onSubmit={submit}>
   <div className="dynamic-fields" style={{ '--field-columns': form.layout?.columns || 2 }}>
    {fields.map(field => <label className={`form-field ${field.width === 'full' ? 'field-full' : ''}`} key={field.key}><span>{field.label}{field.required ? ' *' : ''}</span>
     {field.type === 'textarea' ? <textarea required={field.required} rows={3} placeholder={field.placeholder || ''} value={values[field.key] || ''} onChange={e=>setValue(field.key,e.target.value)}/> : field.type === 'select' ? <select required={field.required} value={values[field.key] || ''} onChange={e=>setValue(field.key,e.target.value)}><option value="">{field.placeholder || 'Choose an option'}</option>{(field.options || []).map(o=><option key={o} value={o}>{o}</option>)}</select> : field.type === 'checkbox' ? <span className="check-field"><input type="checkbox" checked={Boolean(values[field.key])} onChange={e=>setValue(field.key,e.target.checked)}/>{field.placeholder || 'Yes'}</span> : <input required={field.required} type={['email','tel','number','date'].includes(field.type) ? field.type : 'text'} placeholder={field.placeholder || ''} value={values[field.key] || ''} onChange={e=>setValue(field.key,e.target.value)}/>}</label>)}
   </div>
   <p className="form-privacy">Required fields are marked *. Your details are used to prepare and respond to this project brief. Do not include sensitive personal information.</p>
   {error && <p className="form-inline-error">{error}</p>}
   <button className="button button-green submit-button" type="submit" disabled={busy}>{busy ? 'Sending…' : form.submitLabel || 'Send request'} <span>↗</span></button>
  </form>}
 </div>;
}
