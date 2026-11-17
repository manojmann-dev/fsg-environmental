'use client';

import { useMemo } from 'react';

const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'date', 'select', 'textarea', 'checkbox'];
const safeParse = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export default function FormFieldsBuilder({ value, onChange, submitLabel = 'Send request' }) {
  const fields = useMemo(() => safeParse(value), [value]);

  function update(next) {
    onChange(JSON.stringify(next.map((field, index) => ({ ...field, order: index + 1 })), null, 2));
  }

  function patch(index, changes) {
    if (!fields) return;
    update(fields.map((field, i) => i === index ? { ...field, ...changes } : field));
  }

  function move(index, offset) {
    if (!fields) return;
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    update(next);
  }

  function addField() {
    const current = fields || [];
    let suffix = current.length + 1;
    let key = `field${suffix}`;
    while (current.some((field) => field.key === key)) key = `field${++suffix}`;
    update([...current, { key, label: 'New field', type: 'text', placeholder: '', required: false, width: 'half', order: current.length + 1 }]);
  }

  function removeField(index) {
    if (!fields) return;
    update(fields.filter((_, i) => i !== index));
  }

  return (
    <section className="field-builder">
      <div className="field-builder-head">
        <div><b>Form fields</b><small>{fields ? `${fields.length} fields · drag-free reorder controls` : 'Fix the JSON in Advanced schema to continue.'}</small></div>
        <button type="button" className="admin-btn primary small" onClick={addField} disabled={!fields}>+ Add field</button>
      </div>
      {fields ? fields.map((field, index) => (
        <article className="field-builder-row" key={`${field.key || 'field'}-${index}`}>
          <div className="field-builder-order"><b>{String(index + 1).padStart(2, '0')}</b><div><button type="button" aria-label="Move field up" disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="Move field down" disabled={index === fields.length - 1} onClick={() => move(index, 1)}>↓</button></div></div>
          <div className="field-builder-controls">
            <label className="admin-field"><span>Field label</span><input value={field.label || ''} onChange={(e) => patch(index, { label: e.target.value })} /></label>
            <label className="admin-field"><span>Key / variable name</span><input value={field.key || ''} onChange={(e) => patch(index, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} /></label>
            <label className="admin-field"><span>Field type</span><select value={field.type || 'text'} onChange={(e) => patch(index, { type: e.target.value })}>{FIELD_TYPES.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
            <label className="admin-field"><span>Placeholder</span><input value={field.placeholder || ''} onChange={(e) => patch(index, { placeholder: e.target.value })} /></label>
            <label className="admin-field"><span>Width</span><select value={field.width || 'half'} onChange={(e) => patch(index, { width: e.target.value })}><option value="half">Half width</option><option value="full">Full width</option></select></label>
            {field.type === 'select' && <label className="admin-field"><span>Options (comma separated)</span><input value={(field.options || []).join(', ')} onChange={(e) => patch(index, { options: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /></label>}
            <label className="field-builder-required"><input type="checkbox" checked={Boolean(field.required)} onChange={(e) => patch(index, { required: e.target.checked })} /> Required field</label>
          </div>
          <button type="button" className="admin-btn danger small field-remove" onClick={() => removeField(index)}>Remove</button>
        </article>
      )) : <p className="form-inline-error">The field schema is not valid JSON. Correct it in Advanced schema below.</p>}
      <details className="field-builder-advanced">
        <summary>Advanced schema (JSON)</summary>
        <textarea rows={12} value={value || '[]'} onChange={(e) => onChange(e.target.value)} spellCheck="false" />
        <small>Advanced users can edit field properties directly. Supported types: {FIELD_TYPES.join(', ')}. Use a unique key for every field.</small>
      </details>
      {fields && <div className="form-preview"><div className="eyebrow">LIVE FORM PREVIEW</div><h3>Form field layout</h3><div className="form-preview-grid">{fields.map((field, index) => <div className={field.width === 'full' ? 'preview-field full' : 'preview-field'} key={`${field.key}-preview-${index}`}><b>{field.label || 'Untitled field'}{field.required ? ' *' : ''}</b><div>{field.type === 'select' ? 'Choose an option' : field.type === 'textarea' ? 'Long answer area' : field.placeholder || field.type || 'Text field'}</div></div>)}</div><span className="preview-submit">{submitLabel} ↗</span></div>}
    </section>
  );
}
