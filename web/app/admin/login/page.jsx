'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
export default function AdminLogin() {
 const [email,setEmail] = useState(''); const [password,setPassword] = useState(''); const [error,setError] = useState(''); const [busy,setBusy] = useState(false); const router = useRouter();
 async function login(e) { e.preventDefault(); setBusy(true); setError(''); try { const r=await fetch(`${API}/admin/auth/login`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}); const d=await r.json(); if(!r.ok) throw new Error(d.message || 'Sign in failed.'); router.replace('/admin'); } catch(e) { setError(e.message); } finally { setBusy(false); } }
 return <main className="login-page"><form className="login-card" onSubmit={login}><LinkBrand/><div className="eyebrow">SECURE ADMIN ACCESS</div><h1>Sign in to FSG.</h1><p>Manage content, project enquiries and client communication.</p><label>Email address<input type="email" value={email} required onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label>Password<input type="password" value={password} required onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>{error && <div className="form-inline-error">{error}</div>}<button className="button button-green" disabled={busy}>{busy?'Signing in…':'Sign in ↗'}</button><a href="/" className="text-link">← Back to website</a></form></main>;
}
function LinkBrand(){return <div className="brand login-brand"><span className="brand-mark">FSG</span><span className="brand-copy"><b>ENVIRONMENTAL</b><small>FUTURE STARTS GREEN</small></span></div>;}
