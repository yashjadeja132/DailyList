import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../Modal.jsx';
import { IconBtn, Icon } from '../icons.jsx';

function CategoryForm({ category, onClose, onSaved }) {
  const [name, setName] = useState(category?.name || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (category) await api(`/admin/categories/${category.id}`, 'PUT', { name });
      else await api('/admin/categories', 'POST', { name });
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Modal title={category ? 'Edit category' : 'New category'} subtitle="Shop owners pick one category for their shop." onClose={onClose}>
      <form onSubmit={save}>
        {error ? <div className="error">{error}</div> : null}
        <div className="field">
          <label>Category name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bakery" maxLength="40" autoFocus />
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Categories() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null); // null | 'new' | category
  const [error, setError] = useState('');
  const load = () => api('/admin/categories').then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggle = async (c) => { try { await api(`/admin/categories/${c.id}`, 'PUT', { active: !c.active }); load(); } catch (e) { setError(e.message); } };
  const remove = async (c) => {
    if (!window.confirm(`Delete the category "${c.name}"?`)) return;
    try { await api(`/admin/categories/${c.id}`, 'DELETE'); load(); } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Shop categories</h1><p className="sub">The types of shops customers can browse</p></div>
        <button className="btn" onClick={() => setForm('new')}><Icon name="plus" /> New category</button>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Category</th><th className="center">Shops</th><th className="center">Status</th><th className="center">Actions</th></tr></thead>
          <tbody>
            {!rows ? <tr><td colSpan="4" className="empty">Loading…</td></tr> :
              rows.length === 0 ? <tr><td colSpan="4" className="empty">No categories yet.</td></tr> :
                rows.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Category" className="strong">{c.name}</td>
                    <td data-label="Shops" className="center">{c.shops}</td>
                    <td data-label="Status" className="center">{c.active ? <span className="badge green">Active</span> : <span className="badge">Hidden</span>}</td>
                    <td className="actions">
                      <IconBtn icon="edit" title="Edit" onClick={() => setForm(c)} />
                      <IconBtn icon={c.active ? 'eyeoff' : 'eye'} title={c.active ? 'Hide from shop owners' : 'Show to shop owners'} onClick={() => toggle(c)} />
                      <IconBtn icon="trash" title="Delete" tone="danger" onClick={() => remove(c)} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {form ? <CategoryForm category={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} /> : null}
    </>
  );
}
