'use client'

import React, { useState, useEffect } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── TYPES ─────────────────────────────────────────────────────────────────────
type Page = 'dashboard' | 'servicios' | 'insumos' | 'packs' | 'rentabilidad' | 'registro' | 'multiagentes'

interface Svc {
  id: number; nombre: string; categoria: string; pvp: number
  tiempo_min: number; frec_mes: number; sd: number; sm: number; activo: boolean
}
interface Ins {
  id: number; nombre: string; categoria: string; presentacion?: string
  unidad: string; costo_compra: number; contenido: number; stock_actual: number
}
interface Rec { servicio_id: number; insumo_id: number; cantidad: number }
interface VentaMes { id: number; servicio_id: number; mes: number; anio: number; cantidad_real: number }

// ── COST ENGINE ───────────────────────────────────────────────────────────────
const CF = 9110.07
const P = { gob: 0.75, iva: 0.15, com: 0.10 }

function tasaMin(svcs: Svc[]) {
  const tot = svcs.reduce((s, v) => s + v.tiempo_min * v.sm, 0)
  return tot > 0 ? CF / tot : 0
}
function costoIns(id: number, ins: Ins[], recs: Rec[]) {
  return recs.filter(r => r.servicio_id === id).reduce((s, r) => {
    const i = ins.find(x => x.id === r.insumo_id)
    return s + (i && i.contenido > 0 ? (i.costo_compra / i.contenido) * r.cantidad : 0)
  }, 0)
}
function margen(pvp: number, ct: number) { return pvp > 0 ? (pvp - ct) / pvp : 0 }
function precioSug(ct: number) { return (ct / (1 - P.gob)) * (1 + P.iva) / (1 - P.com) }
const f$ = (n: number) => `$${n.toFixed(2)}`
const fp = (n: number) => `${(n * 100).toFixed(1)}%`
const fint = (n: number) => `$${Math.round(n).toLocaleString()}`

// ── BADGE ─────────────────────────────────────────────────────────────────────
function Bdg({ m, pvp }: { m: number; pvp: number }) {
  if (!pvp) return <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>N/A</span>
  if (m >= 0.3) return <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>RENTABLE</span>
  if (m >= 0.1) return <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>REVISAR</span>
  return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>PÉRDIDA</span>
}

// ── MODAL WRAPPER ─────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 480, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        {children}
      </div>
    </div>
  )
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr('')
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pwd })
    if (error) { setErr('Correo o contraseña incorrectos.'); setPwd(''); setLoading(false); return }
    if (data.session) onLogin(data.session)
    setLoading(false)
  }

  return (
    <div style={{ background: '#1a1a2e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 380, maxWidth: '95vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#d4af37', letterSpacing: '.04em' }}>COSMOPOLITAN</div>
          <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 6 }}>Peluquerías · Sistema de Gestión</div>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>Iniciar sesión</h2>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 22px' }}>Ingresa tus credenciales para continuar</p>
          <form onSubmit={doLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>CORREO ELECTRÓNICO</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>CONTRASEÑA</label>
              <div style={{ position: 'relative' }}>
                <input type={show ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••" required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 40px 10px 13px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none' }} />
                <button type="button" onClick={() => setShow(!show)}
                  style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af' }}>
                  {show ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            {err && <div style={{ background: '#fee2e2', color: '#dc2626', fontSize: 12, padding: '9px 12px', borderRadius: 8, marginBottom: 14 }}>{err}</div>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 11, background: '#0f3460', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Ingresando...' : 'Entrar →'}
            </button>
          </form>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, color: '#4b5563', fontSize: 11 }}>NS Consultoría Digital · v2.0 · 2026</div>
      </div>
    </div>
  )
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
const NAV: { id: Page; icon: string; label: string; section: string }[] = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', section: 'PRINCIPAL' },
  { id: 'servicios', icon: '✂️', label: 'Servicios', section: '' },
  { id: 'insumos', icon: '🧴', label: 'Insumos', section: '' },
  { id: 'packs', icon: '🎁', label: 'Crear Packs', section: 'VENTAS' },
  { id: 'rentabilidad', icon: '💰', label: 'Rentabilidad', section: 'ANÁLISIS' },
  { id: 'registro', icon: '📅', label: 'Registro Mensual', section: '' },
  { id: 'multiagentes', icon: '🤖', label: 'Multi-Agentes IA', section: '' },
]

function Sidebar({ page, setPage, onLogout, email }: { page: Page; setPage: (p: Page) => void; onLogout: () => void; email: string }) {
  return (
    <div style={{ background: '#1a1a2e', width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ color: '#d4af37', fontSize: 17, fontWeight: 800 }}>COSMOPOLITAN</div>
        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 3 }}>Peluquerías · Sistema de Gestión</div>
      </div>
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {NAV.map(n => (
          <div key={n.id}>
            {n.section && <div style={{ color: '#4b5563', fontSize: 10, padding: '10px 24px 4px', fontWeight: 700, letterSpacing: '.08em' }}>{n.section}</div>}
            <div onClick={() => setPage(n.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', color: page === n.id ? '#d4af37' : '#9ca3af', background: page === n.id ? '#0f3460' : 'transparent', cursor: 'pointer', borderRadius: 8, margin: '2px 8px', fontSize: 13.5, transition: 'all .15s' }}>
              <span>{n.icon}</span> {n.label}
            </div>
          </div>
        ))}
      </nav>
      <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 8, wordBreak: 'break-all' }}>{email}</div>
        <button onClick={onLogout}
          style={{ width: '100%', padding: '6px 10px', background: 'none', border: '1px solid rgba(255,255,255,.15)', borderRadius: 7, color: '#9ca3af', fontSize: 11, cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ svcs, ins, recs }: { svcs: Svc[]; ins: Ins[]; recs: Rec[] }) {
  const t = tasaMin(svcs)
  const computed = svcs.map(s => {
    const ci = costoIns(s.id, ins, recs)
    const cf = s.tiempo_min * t
    const ct = ci + cf
    const m = margen(s.pvp, ct)
    return { ...s, ci, cf, ct, m, psugg: precioSug(ct), ingresoMes: s.pvp * s.sm }
  })
  const totalIng = computed.reduce((s, r) => s + r.ingresoMes, 0)
  const conPvp = computed.filter(s => s.pvp > 0)
  const avgMg = conPvp.length > 0 ? conPvp.reduce((s, r) => s + r.m, 0) / conPvp.length : 0
  const top5 = [...conPvp].sort((a, b) => b.m - a.m).slice(0, 5)
  const alertas = conPvp.filter(s => s.m < 0.1).slice(0, 6)

  const kpis = [
    { icon: '✂️', bg: '#e0e7ff', label: 'Servicios', val: svcs.length.toString(), sub: `${[...new Set(svcs.map(s => s.categoria))].length} categorías` },
    { icon: '💵', bg: '#fef9c3', label: 'Ingreso Potencial/Mes', val: fint(totalIng), sub: 'con ocupación actual' },
    { icon: '📋', bg: '#fee2e2', label: 'Costos Totales/Mes', val: fint(CF + 9379.37), sub: `Fijos ${fint(CF)} · Var $9,379`, color: '#dc2626' },
    { icon: '📈', bg: '#d1fae5', label: 'Margen Promedio', val: fp(avgMg), sub: 'servicios con precio', color: '#059669' },
    { icon: '⚡', bg: '#fce7f3', label: 'Costo por Minuto', val: `$${t.toFixed(4)}`, sub: 'tasa costos fijos' },
  ]
  const th = { background: '#0f3460', color: '#d4af37', padding: '10px 12px', fontSize: 11.5, fontWeight: 600, textAlign: 'left' as const }
  const td = { padding: '8px 12px', fontSize: 12.5, borderBottom: '1px solid #f3f4f6' }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 18 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{k.icon}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{k.label}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color || '#1a1a2e' }}>{k.val}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 10 }}>⚠️ Servicios bajo costo</h3>
          {alertas.length === 0
            ? <p style={{ fontSize: 12, color: '#10b981' }}>✅ No hay alertas críticas</p>
            : alertas.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 7, background: '#fef2f2', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{s.nombre}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>{fp(s.m)}</span>
              </div>
            ))}
        </div>
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
          <div style={{ background: '#1a1a2e', color: '#d4af37', padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>🏆 Top 5 Servicios Más Rentables</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Servicio', 'PVP', 'Costo', 'Margen', 'Estado'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {top5.map(s => (
                <tr key={s.id}>
                  <td style={{ ...td, fontWeight: 500 }}>{s.nombre}</td>
                  <td style={td}>{f$(s.pvp)}</td>
                  <td style={td}>{f$(s.ct)}</td>
                  <td style={{ ...td, fontWeight: 700, color: s.m >= 0.3 ? '#059669' : s.m >= 0.1 ? '#d97706' : '#dc2626' }}>{fp(s.m)}</td>
                  <td style={td}><Bdg m={s.m} pvp={s.pvp} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── SERVICIOS ─────────────────────────────────────────────────────────────────
const SVC_CATS = ['Uñas','Estilismo','Tratamientos','Colorimetría','Keratina/Nanoplastia','Cortes','Depilación','Ondulación/Rizos','Maquillaje','Otro']

function Servicios({ svcs, setSvcs, ins, recs }: { svcs: Svc[]; setSvcs: (s: Svc[]) => void; ins: Ins[]; recs: Rec[] }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [est, setEst] = useState('')
  const [modal, setModal] = useState<{ open: boolean; mode: 'new'|'edit'; data: Partial<Svc>; preview: { cf:number;ct:number;m:number;ps:number }|null; err: string }>({ open: false, mode: 'new', data: {}, preview: null, err: '' })
  const [saving, setSaving] = useState(false)
  const t = tasaMin(svcs)

  const cats = [...new Set(svcs.map(s => s.categoria))].sort()
  const rows = svcs.filter(s => {
    if (q && !s.nombre.toLowerCase().includes(q.toLowerCase()) && !s.categoria.toLowerCase().includes(q.toLowerCase())) return false
    if (cat && s.categoria !== cat) return false
    return true
  }).map(s => {
    const ci = costoIns(s.id, ins, recs), cf = s.tiempo_min * t, ct = ci + cf, m = margen(s.pvp, ct)
    if (est) { const e = !s.pvp ? 'N/A' : m >= 0.3 ? 'RENTABLE' : m >= 0.1 ? 'REVISAR' : 'PÉRDIDA'; if (e !== est) return null }
    return { ...s, ci, cf, ct, m, psugg: precioSug(ct) }
  }).filter(Boolean) as (Svc & { ci:number;cf:number;ct:number;m:number;psugg:number })[]

  function calcPrev(data = modal.data) {
    if (!data.pvp || !data.tiempo_min) { setModal(m => ({ ...m, preview: null })); return }
    const ci = data.id ? costoIns(data.id, ins, recs) : 0
    const cf = (data.tiempo_min || 0) * t, ct = ci + cf, m = margen(data.pvp || 0, ct)
    setModal(prev => ({ ...prev, preview: { cf, ct, m, ps: precioSug(ct) } }))
  }
  function updF(field: string, val: unknown) { const nd = { ...modal.data, [field]: val }; setModal(prev => ({ ...prev, data: nd })); if (field === 'pvp' || field === 'tiempo_min') calcPrev(nd) }

  async function save() {
    const d = modal.data
    if (!d.nombre?.trim() || !d.categoria || !d.pvp || !d.tiempo_min) { setModal(m => ({ ...m, err: 'Completa nombre, categoría, PVP y duración.' })); return }
    setSaving(true)
    if (modal.mode === 'new') {
      const { data, error } = await sb.from('servicios').insert([{ nombre: d.nombre, categoria: d.categoria, pvp: d.pvp, tiempo_min: d.tiempo_min, frec_mes: d.frec_mes || 30, sd: d.sd || 4, sm: d.sm || 120, activo: true }]).select().single()
      if (error) { setModal(m => ({ ...m, err: error.message })); setSaving(false); return }
      setSvcs([...svcs, data])
    } else {
      const { error } = await sb.from('servicios').update({ nombre: d.nombre, categoria: d.categoria, pvp: d.pvp, tiempo_min: d.tiempo_min, sd: d.sd || 4, sm: d.sm || 120 }).eq('id', d.id!)
      if (error) { setModal(m => ({ ...m, err: error.message })); setSaving(false); return }
      setSvcs(svcs.map(s => s.id === d.id ? { ...s, ...d } as Svc : s))
    }
    setSaving(false); setModal(m => ({ ...m, open: false }))
  }

  const inp = (v: string|number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder='', type='text') => (
    <input type={type} value={v} onChange={onChange} placeholder={placeholder}
      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', padding: '8px 11px', borderRadius: 8, fontSize: 12.5, outline: 'none' }} />
  )
  const th = { background: '#0f3460', color: '#d4af37', padding: '10px 12px', fontSize: 11.5, fontWeight: 600, textAlign: 'left' as const, whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0 }
  const td = { padding: '8px 12px', fontSize: 12.5, borderBottom: '1px solid #f3f4f6' }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid #f3f4f6' }}>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍  Buscar servicio…"
            style={{ width: 220, border: '1px solid #e5e7eb', padding: '7px 11px', borderRadius: 8, fontSize: 12.5, outline: 'none' }} />
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ border: '1px solid #e5e7eb', padding: '7px 11px', borderRadius: 8, fontSize: 12.5 }}>
            <option value="">Todas las categorías</option>{cats.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={est} onChange={e => setEst(e.target.value)} style={{ border: '1px solid #e5e7eb', padding: '7px 11px', borderRadius: 8, fontSize: 12.5 }}>
            <option value="">Todos los estados</option><option>RENTABLE</option><option>REVISAR</option><option>PÉRDIDA</option>
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{rows.length} servicios</span>
            <button onClick={() => setModal({ open: true, mode: 'new', data: { pvp: 0, tiempo_min: 60, sd: 4, sm: 120 }, preview: null, err: '' })}
              style={{ padding: '7px 14px', background: '#0f3460', color: 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
              + Agregar Servicio
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#','Servicio','Categoría','PVP $','Tiempo','Costo Ins.','Costo Fijo','Costo Total','Utilidad','Margen%','P.Sugerido','Estado',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...td, color: '#9ca3af' }}>{s.id}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{s.nombre}</td>
                  <td style={td}><span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{s.categoria}</span></td>
                  <td style={{ ...td, fontWeight: 700 }}>{f$(s.pvp)}</td>
                  <td style={td}>{s.tiempo_min} min</td>
                  <td style={{ ...td, color: '#6b7280' }}>{f$(s.ci)}</td>
                  <td style={{ ...td, color: '#6b7280' }}>{f$(s.cf)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{f$(s.ct)}</td>
                  <td style={{ ...td, fontWeight: 600, color: s.pvp - s.ct >= 0 ? '#059669' : '#dc2626' }}>{f$(s.pvp - s.ct)}</td>
                  <td style={{ ...td, fontWeight: 700, color: s.m >= 0.3 ? '#059669' : s.m >= 0.1 ? '#d97706' : '#dc2626' }}>{fp(s.m)}</td>
                  <td style={{ ...td, color: '#2563eb', fontWeight: 600 }}>{f$(s.psugg)}</td>
                  <td style={td}><Bdg m={s.m} pvp={s.pvp} /></td>
                  <td style={td}><button onClick={() => { setModal({ open: true, mode: 'edit', data: { ...s }, preview: null, err: '' }); calcPrev({ ...s }) }}
                    style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>✏️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && (
        <Modal onClose={() => setModal(m => ({ ...m, open: false }))}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{modal.mode === 'new' ? '✂️ Nuevo Servicio' : '✏️ Editar Servicio'}</h2>
            <button onClick={() => setModal(m => ({ ...m, open: false }))} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>NOMBRE *</label>
              {inp(modal.data.nombre || '', e => updF('nombre', e.target.value), 'Ej: Corte + Cepillado')}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>CATEGORÍA *</label>
              <select value={modal.data.categoria || ''} onChange={e => updF('categoria', e.target.value)}
                style={{ width: '100%', border: '1px solid #e5e7eb', padding: '8px 11px', borderRadius: 8, fontSize: 12.5 }}>
                <option value="">Seleccionar…</option>{SVC_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>PVP $ *</label>
              {inp(modal.data.pvp || '', e => updF('pvp', parseFloat(e.target.value) || 0), '25.00', 'number')}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>DURACIÓN (min) *</label>
              {inp(modal.data.tiempo_min || '', e => updF('tiempo_min', parseInt(e.target.value) || 0), '60', 'number')}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>VECES/DÍA</label>
              {inp(modal.data.sd || '', e => updF('sd', parseInt(e.target.value) || 4), '4', 'number')}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>VECES/MES</label>
              {inp(modal.data.sm || '', e => updF('sm', parseInt(e.target.value) || 120), '120', 'number')}
            </div>
          </div>
          {modal.preview && (
            <div style={{ background: '#f8f9ff', border: '1.5px solid #e0e7ff', borderRadius: 10, padding: 12, marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>VISTA PREVIA DE COSTOS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
                <span style={{ color: '#6b7280' }}>Costo fijo:</span><span style={{ fontWeight: 600 }}>{f$(modal.preview.cf)}</span>
                <span style={{ color: '#6b7280' }}>Costo total:</span><span style={{ fontWeight: 600 }}>{f$(modal.preview.ct)}</span>
                <span style={{ color: '#6b7280' }}>Margen:</span><span style={{ fontWeight: 700, color: modal.preview.m >= 0.3 ? '#059669' : modal.preview.m >= 0.1 ? '#d97706' : '#dc2626' }}>{fp(modal.preview.m)}</span>
                <span style={{ color: '#6b7280' }}>P. sugerido:</span><span style={{ fontWeight: 600, color: '#2563eb' }}>{f$(modal.preview.ps)}</span>
              </div>
            </div>
          )}
          {modal.err && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{modal.err}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={() => setModal(m => ({ ...m, open: false }))} style={{ flex: 1, padding: 9, background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 12.5 }}>Cancelar</button>
            <button onClick={() => calcPrev()} style={{ flex: 1, padding: 9, background: '#0f3460', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5 }}>Ver costos</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, padding: 9, background: '#d4af37', color: '#1a1a2e', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}>
              {saving ? 'Guardando...' : '💾 Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── INSUMOS ───────────────────────────────────────────────────────────────────
function Insumos({ ins, setIns }: { ins: Ins[]; setIns: (i: Ins[]) => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [modal, setModal] = useState<{ open: boolean; mode: 'new'|'edit'; data: Partial<Ins>; err: string }>({ open: false, mode: 'new', data: {}, err: '' })
  const [saving, setSaving] = useState(false)

  const cats = [...new Set(ins.map(i => i.categoria))].sort()
  const rows = ins.filter(i => {
    if (q && !i.nombre.toLowerCase().includes(q.toLowerCase())) return false
    if (cat && i.categoria !== cat) return false
    return true
  })

  function updF(f: string, v: unknown) { setModal(prev => ({ ...prev, data: { ...prev.data, [f]: v } })) }

  async function save() {
    const d = modal.data
    if (!d.nombre?.trim() || !d.categoria) { setModal(m => ({ ...m, err: 'Completa nombre y categoría.' })); return }
    setSaving(true)
    const payload = { nombre: d.nombre, categoria: d.categoria, presentacion: d.presentacion || '', unidad: d.unidad || 'ml', costo_compra: d.costo_compra || 0, contenido: d.contenido || 0, stock_actual: d.stock_actual || 0 }
    if (modal.mode === 'new') {
      const { data, error } = await sb.from('insumos').insert([payload]).select().single()
      if (error) { setModal(m => ({ ...m, err: error.message })); setSaving(false); return }
      setIns([...ins, data])
    } else {
      const { error } = await sb.from('insumos').update(payload).eq('id', d.id!)
      if (error) { setModal(m => ({ ...m, err: error.message })); setSaving(false); return }
      setIns(ins.map(i => i.id === d.id ? { ...i, ...payload } as Ins : i))
    }
    setSaving(false); setModal(m => ({ ...m, open: false }))
  }

  const inp = (v: string|number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder='', type='text') => (
    <input type={type} value={v} onChange={onChange} placeholder={placeholder}
      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', padding: '8px 11px', borderRadius: 8, fontSize: 12.5, outline: 'none' }} />
  )
  const th = { background: '#0f3460', color: '#d4af37', padding: '10px 12px', fontSize: 11.5, fontWeight: 600, textAlign: 'left' as const }
  const td = { padding: '8px 12px', fontSize: 12.5, borderBottom: '1px solid #f3f4f6' }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid #f3f4f6' }}>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍  Buscar insumo…"
            style={{ width: 220, border: '1px solid #e5e7eb', padding: '7px 11px', borderRadius: 8, fontSize: 12.5, outline: 'none' }} />
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ border: '1px solid #e5e7eb', padding: '7px 11px', borderRadius: 8, fontSize: 12.5 }}>
            <option value="">Todas las categorías</option>{cats.map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={() => setModal({ open: true, mode: 'new', data: { unidad: 'ml', costo_compra: 0, contenido: 0, stock_actual: 0 }, err: '' })}
              style={{ padding: '7px 14px', background: '#d4af37', color: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              + Agregar Insumo
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['#','Nombre','Categoría','Presentación','Unid.','Costo Compra','Contenido','Costo/Unid.','Stock',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(i => {
                const cu = i.contenido > 0 ? i.costo_compra / i.contenido : 0
                return (
                  <tr key={i.id}>
                    <td style={{ ...td, color: '#9ca3af' }}>{i.id}</td>
                    <td style={{ ...td, fontWeight: 500 }}>{i.nombre}</td>
                    <td style={td}><span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{i.categoria}</span></td>
                    <td style={{ ...td, color: '#6b7280' }}>{i.presentacion}</td>
                    <td style={td}>{i.unidad}</td>
                    <td style={td}>{f$(i.costo_compra)}</td>
                    <td style={td}>{i.contenido}</td>
                    <td style={{ ...td, fontWeight: 600, color: '#059669' }}>${cu.toFixed(4)}</td>
                    <td style={td}>{i.stock_actual}</td>
                    <td style={td}><button onClick={() => setModal({ open: true, mode: 'edit', data: { ...i }, err: '' })}
                      style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>✏️</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && (
        <Modal onClose={() => setModal(m => ({ ...m, open: false }))}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{modal.mode === 'new' ? '🧴 Nuevo Insumo' : '✏️ Editar Insumo'}</h2>
            <button onClick={() => setModal(m => ({ ...m, open: false }))} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>NOMBRE *</label>
              {inp(modal.data.nombre || '', e => updF('nombre', e.target.value))}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>CATEGORÍA *</label>
              {inp(modal.data.categoria || '', e => updF('categoria', e.target.value), 'Color, General...')}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>PRESENTACIÓN</label>
              {inp(modal.data.presentacion || '', e => updF('presentacion', e.target.value), 'Tubo 60gr')}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>UNIDAD</label>
              {inp(modal.data.unidad || 'ml', e => updF('unidad', e.target.value), 'ml / gr / unidad')}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>COSTO COMPRA $</label>
              {inp(modal.data.costo_compra || '', e => updF('costo_compra', parseFloat(e.target.value) || 0), '0.00', 'number')}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>CONTENIDO (unidades)</label>
              {inp(modal.data.contenido || '', e => updF('contenido', parseFloat(e.target.value) || 0), '1000', 'number')}
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>STOCK ACTUAL</label>
              {inp(modal.data.stock_actual || '', e => updF('stock_actual', parseFloat(e.target.value) || 0), '0', 'number')}
            </div>
          </div>
          {modal.err && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{modal.err}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={() => setModal(m => ({ ...m, open: false }))} style={{ flex: 1, padding: 9, background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 12.5 }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, padding: 9, background: '#d4af37', color: '#1a1a2e', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}>
              {saving ? 'Guardando...' : '💾 Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── PACKS ─────────────────────────────────────────────────────────────────────
function Packs({ svcs, ins, recs }: { svcs: Svc[]; ins: Ins[]; recs: Rec[] }) {
  const [sel, setSel] = useState<number[]>([])
  const [packName, setPackName] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [msg, setMsg] = useState('')
  const t = tasaMin(svcs)
  const cats = [...new Set(svcs.map(s => s.categoria))].sort()
  const filtered = svcs.filter(s => !filterCat || s.categoria === filterCat)
  const selSvcs = svcs.filter(s => sel.includes(s.id))
  const totalNormal = selSvcs.reduce((s, v) => s + v.pvp, 0)
  const totalCosto = selSvcs.reduce((s, v) => { const ci = costoIns(v.id, ins, recs); return s + ci + v.tiempo_min * t }, 0)
  const totalTiempo = selSvcs.reduce((s, v) => s + v.tiempo_min, 0)
  const precioPack = totalNormal * 0.80
  const mPack = precioPack > 0 ? (precioPack - totalCosto) / precioPack : 0

  function toggle(id: number) { setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }

  async function guardar() {
    if (!packName.trim() || sel.length < 2) { setMsg('Escribe un nombre y selecciona al menos 2 servicios.'); return }
    const { data, error } = await sb.from('packs').insert([{ nombre: packName, descuento: 0.20, activo: true }]).select().single()
    if (error || !data) { setMsg('Error al guardar: ' + error?.message); return }
    await sb.from('pack_items').insert(sel.map(sid => ({ pack_id: data.id, servicio_id: sid })))
    setMsg(`✅ Pack "${packName}" guardado en la nube`)
    setSel([]); setPackName('')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>🛠️ Constructor de Pack Personalizado</h3>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Selecciona 2 o más servicios:</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterCat('')} style={{ padding: '5px 10px', background: !filterCat ? '#0f3460' : 'white', color: !filterCat ? 'white' : '#374151', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Todos</button>
            {cats.map(c => <button key={c} onClick={() => setFilterCat(c === filterCat ? '' : c)} style={{ padding: '5px 10px', background: filterCat === c ? '#0f3460' : 'white', color: filterCat === c ? 'white' : '#374151', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>{c}</button>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
            {filtered.map(s => (
              <div key={s.id} onClick={() => toggle(s.id)}
                style={{ background: sel.includes(s.id) ? '#fffbeb' : 'white', border: `2px solid ${sel.includes(s.id) ? '#d4af37' : '#e5e7eb'}`, borderRadius: 10, padding: 10, cursor: 'pointer', fontSize: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>{s.nombre}</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>{s.categoria}</div>
                <div style={{ fontWeight: 700, color: '#1a1a2e', marginTop: 4 }}>{f$(s.pvp)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.07)', position: 'sticky', top: 0, alignSelf: 'start' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🧾 Tu Pack</h3>
          <input type="text" value={packName} onChange={e => setPackName(e.target.value)} placeholder="Nombre del pack…"
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', padding: '8px 11px', borderRadius: 8, fontSize: 12.5, outline: 'none', marginBottom: 10 }} />
          <div style={{ minHeight: 60, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
            {selSvcs.length === 0 ? <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 16 }}>Selecciona servicios →</p>
              : selSvcs.map(s => <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}><span>{s.nombre}</span><span style={{ fontWeight: 600 }}>{f$(s.pvp)}</span></div>)}
          </div>
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
            {[['Precio normal:', f$(totalNormal)], ['Costo total:', f$(totalCosto)], ['Tiempo total:', `${totalTiempo} min`]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                <span style={{ color: '#6b7280' }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 10, marginTop: 6 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Precio con 20% descuento:</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e' }}>{f$(precioPack)}</div>
              <div style={{ fontSize: 12, color: mPack >= 0.3 ? '#059669' : '#d97706', marginTop: 3 }}>Margen: {fp(mPack)}</div>
            </div>
            {msg && <div style={{ fontSize: 12, color: msg.startsWith('✅') ? '#059669' : '#dc2626', marginBottom: 8, textAlign: 'center' }}>{msg}</div>}
            <button onClick={guardar} style={{ width: '100%', padding: 10, background: sel.length >= 2 && packName.trim() ? '#d4af37' : '#e5e7eb', color: '#1a1a2e', border: 'none', borderRadius: 8, cursor: sel.length >= 2 ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 700 }}>
              💾 Guardar Pack en la nube
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── RENTABILIDAD ──────────────────────────────────────────────────────────────
function Rentabilidad({ svcs, ins, recs }: { svcs: Svc[]; ins: Ins[]; recs: Rec[] }) {
  const t = tasaMin(svcs)
  const computed = svcs.filter(s => s.pvp > 0).map(s => {
    const ci = costoIns(s.id, ins, recs), cf = s.tiempo_min * t, ct = ci + cf, m = margen(s.pvp, ct)
    return { ...s, ci, cf, ct, m }
  }).sort((a, b) => b.m - a.m)
  const top10 = computed.slice(0, 10)
  const bot10 = [...computed].reverse().slice(0, 10)
  const cats = [...new Set(svcs.map(s => s.categoria))]
  const bycat = cats.map(c => {
    const cs = computed.filter(s => s.categoria === c)
    return { cat: c, count: cs.length, avgM: cs.length > 0 ? cs.reduce((s, r) => s + r.m, 0) / cs.length : 0, totalIng: cs.reduce((s, r) => s + r.pvp * r.sm, 0) }
  }).sort((a, b) => b.avgM - a.avgM)
  const th = { background: '#0f3460', color: '#d4af37', padding: '10px 12px', fontSize: 11.5, fontWeight: 600, textAlign: 'left' as const }
  const td = { padding: '8px 12px', fontSize: 12.5, borderBottom: '1px solid #f3f4f6' }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ background: '#1a1a2e', color: '#d4af37', padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>📊 Resumen por Categoría</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Categoría', 'Servicios', 'Margen Promedio', 'Ingreso/Mes'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{bycat.map(c => (
            <tr key={c.cat}>
              <td style={{ ...td, fontWeight: 500 }}>{c.cat}</td>
              <td style={td}>{c.count}</td>
              <td style={{ ...td, fontWeight: 700, color: c.avgM >= 0.3 ? '#059669' : c.avgM >= 0.1 ? '#d97706' : '#dc2626' }}>{fp(c.avgM)}</td>
              <td style={{ ...td, fontWeight: 600 }}>{fint(c.totalIng)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[{ title: '🏆 Top 10 Más Rentables', rows: top10 }, { title: '⚠️ 10 A Revisar / En Pérdida', rows: bot10 }].map(({ title, rows }) => (
          <div key={title} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
            <div style={{ background: '#1a1a2e', color: '#d4af37', padding: '9px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Servicio', 'PVP', 'Costo', 'Margen%'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{rows.map(s => (
                <tr key={s.id}>
                  <td style={{ ...td, fontWeight: 500 }}>{s.nombre}</td>
                  <td style={td}>{f$(s.pvp)}</td>
                  <td style={td}>{f$(s.ct)}</td>
                  <td style={{ ...td, fontWeight: 700, color: s.m >= 0.3 ? '#059669' : s.m >= 0.1 ? '#d97706' : '#dc2626' }}>{fp(s.m)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MULTI-AGENTES IA ──────────────────────────────────────────────────────────
function MultiAgentes({ svcs, ins, recs }: { svcs: Svc[]; ins: Ins[]; recs: Rec[] }) {
  type Estado = 'idle' | 'contador' | 'administrador' | 'gerente' | 'listo'
  const [estado, setEstado] = React.useState<Estado>('idle')
  const [informes, setInformes] = React.useState({ contador: '', administrador: '', gerente: '' })
  const [error, setError] = React.useState('')
  const [expandido, setExpandido] = React.useState({ contador: true, administrador: true, gerente: true })

  function buildCtx() {
    const t = tasaMin(svcs)
    const totalMes = svcs.reduce((s, x) => s + x.pvp * x.frec_mes, 0)
    const cats = [...new Set(svcs.map(s => s.categoria))]
    const resCats = cats.map(cat => {
      const cs = svcs.filter(s => s.categoria === cat)
      const ing = cs.reduce((s, x) => s + x.pvp * x.frec_mes, 0)
      return `  ${cat}: ${cs.length} servicios, $${ing.toFixed(0)}/mes`
    }).join('\n')
    const detalle = svcs.map(s => {
      const ci = costoIns(s.id, ins, recs)
      const cf = s.tiempo_min * t
      const ct = ci + cf
      const mg = margen(s.pvp, ct)
      return `${s.nombre} | Cat:${s.categoria} | PVP:$${s.pvp} | Costo:$${ct.toFixed(2)} | Margen:${(mg*100).toFixed(1)}% | ${s.frec_mes}x/mes | Ing.mes:$${(s.pvp*s.frec_mes).toFixed(0)}`
    }).join('\n')
    return `COSMOPOLITAN PELUQUERÍAS · ECUADOR
Servicios: ${svcs.length} | Insumos: ${ins.length} | Costo Fijo Mensual: $${CF.toFixed(2)}
Ingreso potencial mensual: $${totalMes.toFixed(2)}

INGRESOS POR CATEGORÍA:
${resCats}

DETALLE DE SERVICIOS (nombre | categoría | PVP | costo total | margen | frecuencia | ingreso/mes):
${detalle}`
  }

  async function llamar(rol: string, instruccion: string, contexto: string): Promise<string> {
    const r = await fetch('/api/agente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rol, instruccion, contexto }),
    })
    const d = await r.json()
    if (d.error) throw new Error(d.error)
    return d.respuesta || ''
  }

  async function generar() {
    setError(''); setInformes({ contador: '', administrador: '', gerente: '' })
    const ctx = buildCtx()
    try {
      setEstado('contador')
      const rC = await llamar(
        'CONTADOR',
        'Genera un informe financiero completo con: 1) Ingresos potenciales por categoría (tabla), 2) Top 5 servicios más rentables (por margen %), 3) Servicios con margen bajo (menos del 30%), 4) Resumen de costos fijos vs variables, 5) Alertas financieras urgentes.',
        ctx
      )
      setInformes(p => ({ ...p, contador: rC }))

      setEstado('administrador')
      const rA = await llamar(
        'ADMINISTRADOR OPERATIVO',
        'Con base en el informe financiero del contador, genera: 1) Análisis de capacidad operativa (tiempo por categoría), 2) Servicios a potenciar urgentemente (alta rentabilidad + demanda), 3) Servicios a revisar o rediseñar, 4) Recomendaciones de ajuste de precios, 5) Plan de acción operativo para este mes.',
        `${ctx}\n\n=== INFORME DEL CONTADOR ===\n${rC}`
      )
      setInformes(p => ({ ...p, administrador: rA }))

      setEstado('gerente')
      const rG = await llamar(
        'GERENTE GENERAL',
        'Con los informes del contador y administrador, toma decisiones ejecutivas: 1) Las 3 decisiones estratégicas más urgentes para este mes, 2) Objetivos de crecimiento a 3 meses con cifras concretas, 3) KPIs semanales clave a monitorear, 4) Principales riesgos y plan de mitigación, 5) Veredicto ejecutivo: ¿el negocio va bien? ¿qué cambia hoy?',
        `${ctx}\n\n=== INFORME CONTADOR ===\n${rC}\n\n=== INFORME ADMINISTRADOR ===\n${rA}`
      )
      setInformes(p => ({ ...p, gerente: rG }))
      setEstado('listo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setEstado('idle')
    }
  }

  function exportarPDF() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Análisis Multi-Agente · Cosmopolitan</title>
<style>body{font-family:Arial,sans-serif;padding:30px;color:#1a1a2e;max-width:900px;margin:0 auto}
h1{color:#0f3460;border-bottom:3px solid #d4af37;padding-bottom:12px}
h2{margin-top:32px;padding:10px 16px;border-radius:8px;font-size:15px}
.cnt{background:#ecfdf5;color:#065f46}.adm{background:#eff6ff;color:#1e40af}.ger{background:#fffbeb;color:#92400e}
pre{white-space:pre-wrap;font-family:Arial;line-height:1.7;font-size:13px;margin:0;padding:16px;background:#f9fafb;border-radius:6px}
.footer{margin-top:40px;color:#9ca3af;font-size:11px;text-align:center}</style></head>
<body><h1>🤖 Análisis Estratégico Multi-Agente</h1>
<p style="color:#6b7280;font-size:13px">Cosmopolitan Peluquerías · Ecuador · ${new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<h2 class="cnt">📊 CONTADOR — Análisis Financiero</h2><pre>${informes.contador}</pre>
<h2 class="adm">⚙️ ADMINISTRADOR — Gestión Operativa</h2><pre>${informes.administrador}</pre>
<h2 class="ger">👔 GERENTE GENERAL — Decisiones Estratégicas</h2><pre>${informes.gerente}</pre>
<div class="footer">Generado por Cosmo IA · NS Consultoría Digital · cosmopolitan-app.vercel.app</div>
</body></html>`)
    w.document.close(); w.print()
  }

  const agentes = [
    { key: 'contador' as const, label: 'Contador', emoji: '📊', color: '#10b981', bg: '#ecfdf5', desc: 'Análisis financiero y contable' },
    { key: 'administrador' as const, label: 'Administrador', emoji: '⚙️', color: '#3b82f6', bg: '#eff6ff', desc: 'Gestión operativa y precios' },
    { key: 'gerente' as const, label: 'Gerente General', emoji: '👔', color: '#d4af37', bg: '#fffbeb', desc: 'Decisiones estratégicas ejecutivas' },
  ]
  const pasos: Estado[] = ['contador', 'administrador', 'gerente', 'listo']
  const etiqueta: Record<Estado, string> = {
    idle: '', contador: '📊 Contador analizando finanzas...', administrador: '⚙️ Administrador revisando operaciones...', gerente: '👔 Gerente tomando decisiones estratégicas...', listo: '✅ Análisis completo — 3 agentes listos',
  }

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      {/* Header card */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', margin: '0 0 4px' }}>🤖 Flujo Multi-Agente IA</h2>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Tres agentes IA trabajan en cadena con los datos reales de Cosmopolitan</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {estado === 'listo' && (
              <button onClick={exportarPDF} style={{ padding: '8px 14px', background: '#0f3460', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📄 PDF</button>
            )}
            <button onClick={generar} disabled={estado !== 'idle' && estado !== 'listo'}
              style={{ padding: '8px 20px', background: (estado === 'idle' || estado === 'listo') ? '#d4af37' : '#9ca3af', color: 'white', border: 'none', borderRadius: 8, cursor: (estado === 'idle' || estado === 'listo') ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
              {estado === 'idle' ? '▶ Generar Análisis' : estado === 'listo' ? '🔄 Regenerar' : '⏳ Procesando...'}
            </button>
          </div>
        </div>

        {/* Pipeline visual */}
        {estado !== 'idle' && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {agentes.map((a, i) => {
                const done = informes[a.key] !== ''
                const active = estado === a.key
                return (
                  <React.Fragment key={a.key}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: done ? a.color : active ? a.color : '#e5e7eb', color: done || active ? 'white' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 18, boxShadow: active ? `0 0 0 4px ${a.color}33` : 'none', transition: 'all .3s' }}>
                        {done ? '✓' : a.emoji}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: done ? a.color : active ? a.color : '#9ca3af' }}>{a.label}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{a.desc}</div>
                    </div>
                    {i < 2 && <div style={{ width: 40, height: 2, background: informes[agentes[i+1].key] !== '' ? '#10b981' : '#e5e7eb', flexShrink: 0, transition: 'background .5s' }} />}
                  </React.Fragment>
                )
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{etiqueta[estado]}</div>
          </div>
        )}
        {error && <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 12 }}>❌ {error}</div>}
      </div>

      {/* Agent report cards */}
      {agentes.map(a => {
        const texto = informes[a.key]
        const isActive = estado === a.key
        if (!texto && !isActive) return null
        const exp = expandido[a.key]
        return (
          <div key={a.key} style={{ background: 'white', borderRadius: 12, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden', border: `2px solid ${isActive ? a.color : 'transparent'}`, transition: 'border .3s' }}>
            <div onClick={() => setExpandido(p => ({ ...p, [a.key]: !p[a.key] }))}
              style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isActive ? a.bg : '#fafafa', borderBottom: exp ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{a.emoji}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{a.desc}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isActive && !texto && <span style={{ fontSize: 11, color: a.color, fontWeight: 600 }}>Analizando…</span>}
                {texto && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✓ Listo</span>}
                <span style={{ color: '#9ca3af' }}>{exp ? '▲' : '▼'}</span>
              </div>
            </div>
            {exp && (
              <div style={{ padding: 18 }}>
                {isActive && !texto
                  ? <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca3af' }}><div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div><div style={{ fontSize: 13 }}>Procesando…</div></div>
                  : <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.75, color: '#374151', margin: 0 }}>{texto}</pre>
                }
              </div>
            )}
          </div>
        )
      })}

      {/* Idle state */}
      {estado === 'idle' && (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🤖</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>Análisis estratégico automático en cadena</div>
          <div style={{ fontSize: 13, color: '#6b7280', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
            El <strong>Contador</strong> analiza finanzas → el <strong>Administrador</strong> propone acciones → el <strong>Gerente</strong> toma decisiones.<br />
            Cada agente recibe el informe del anterior para dar una recomendación más inteligente.
          </div>
          <button onClick={generar} style={{ marginTop: 20, padding: '11px 28px', background: '#d4af37', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            ▶ Generar Análisis Completo
          </button>
        </div>
      )}
    </div>
  )
}

// ── ASISTENTE IA ─────────────────────────────────────────────────────────────
interface MsgIA { role: 'user' | 'assistant'; content: string }

function AsistenteIA({ svcs, ins, recs }: { svcs: Svc[]; ins: Ins[]; recs: Rec[] }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<MsgIA[]>([{ role: 'assistant', content: '¡Hola! Soy **Cosmo IA** 🤖, tu asistente de negocios. Puedo analizar los datos de Cosmopolitan y ayudarte a tomar mejores decisiones. ¿En qué te puedo ayudar hoy?' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  function buildContexto() {
    const t = tasaMin(svcs)
    const computed = svcs.map(s => {
      const ci = costoIns(s.id, ins, recs), cf = s.tiempo_min * t, ct = ci + cf, m = margen(s.pvp, ct)
      return { ...s, ci, cf, ct, m, ingMes: s.pvp * s.sm }
    })
    const totalIng = computed.reduce((s, r) => s + r.ingMes, 0)
    const conPvp = computed.filter(s => s.pvp > 0)
    const avgMg = conPvp.length > 0 ? conPvp.reduce((s, r) => s + r.m, 0) / conPvp.length : 0
    const top5 = [...conPvp].sort((a, b) => b.m - a.m).slice(0, 5)
    const bajos = conPvp.filter(s => s.m < 0.1)
    const cats = [...new Set(svcs.map(s => s.categoria))]
    const resumenCats = cats.map(c => {
      const cs = computed.filter(s => s.categoria === c)
      const avgM = cs.length > 0 ? cs.reduce((s, r) => s + r.m, 0) / cs.length : 0
      return `  - ${c}: ${cs.length} servicios, margen promedio ${fp(avgM)}, ingreso proyectado ${fint(cs.reduce((s, r) => s + r.ingMes, 0))}/mes`
    }).join('\n')

    return `RESUMEN GENERAL:
- Total servicios activos: ${svcs.length}
- Total insumos registrados: ${ins.length}
- Ingreso potencial mensual: ${fint(totalIng)}
- Costos fijos mensuales: $9,110.07
- Costo variable mensual estimado: $9,379.37
- Margen promedio general: ${fp(avgMg)}
- Costo por minuto de operación: $${t.toFixed(4)}

CATEGORÍAS:
${resumenCats}

TOP 5 SERVICIOS MÁS RENTABLES:
${top5.map(s => `  - ${s.nombre} (${s.categoria}): PVP ${f$(s.pvp)}, Costo ${f$(s.ct)}, Margen ${fp(s.m)}`).join('\n')}

SERVICIOS EN PÉRDIDA O RIESGO (margen < 10%):
${bajos.length > 0 ? bajos.map(s => `  - ${s.nombre}: PVP ${f$(s.pvp)}, Costo ${f$(s.ct)}, Margen ${fp(s.m)}`).join('\n') : 'Ninguno'}

TODOS LOS SERVICIOS:
${computed.map(s => `  - ${s.nombre} | ${s.categoria} | PVP: ${f$(s.pvp)} | Costo: ${f$(s.ct)} | Margen: ${fp(s.m)} | Proyectado: ${s.sm} veces/mes`).join('\n')}`
  }

  async function enviar() {
    if (!input.trim() || loading) return
    const userMsg: MsgIA = { role: 'user', content: input.trim() }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs); setInput(''); setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs, contexto: buildContexto() })
      })
      const data = await res.json()
      setMsgs(prev => [...prev, { role: 'assistant', content: data.respuesta || data.error || 'Error' }])
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: '❌ Error de conexión. Intenta de nuevo.' }])
    }
    setLoading(false)
  }

  const sugerencias = ['¿Qué servicio es el más rentable?', '¿Qué servicios están en pérdida?', '¿Cómo puedo mejorar el margen de Depilación?', '¿Cuál es mi ingreso potencial mensual?']

  return (
    <>
      {/* Botón flotante */}
      <button onClick={() => setOpen(!open)}
        style={{ position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%', background: open ? '#dc2626' : '#0f3460', color: 'white', border: 'none', fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,.3)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
        {open ? '✕' : '🤖'}
      </button>

      {/* Panel de chat */}
      {open && (
        <div style={{ position: 'fixed', bottom: 90, right: 24, width: 380, height: 520, background: 'white', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,.2)', zIndex: 998, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: '#1a1a2e', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0f3460', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
            <div>
              <div style={{ color: '#d4af37', fontWeight: 700, fontSize: 14 }}>Cosmo IA</div>
              <div style={{ color: '#9ca3af', fontSize: 11 }}>Asistente de negocios · Cosmopolitan</div>
            </div>
            <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
          </div>

          {/* Mensajes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '82%', padding: '9px 13px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? '#0f3460' : '#f3f4f6', color: m.role === 'user' ? 'white' : '#1a1a2e', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {m.content.replace(/\*\*(.*?)\*\*/g, '$1')}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '9px 13px', borderRadius: '14px 14px 14px 4px', background: '#f3f4f6', color: '#6b7280', fontSize: 13 }}>Analizando datos... ⏳</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Sugerencias (solo si pocos mensajes) */}
          {msgs.length <= 1 && (
            <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sugerencias.map(s => (
                <button key={s} onClick={() => { setInput(s); }} style={{ padding: '5px 10px', background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
              placeholder="Pregunta sobre el negocio..." disabled={loading}
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
            <button onClick={enviar} disabled={loading || !input.trim()}
              style={{ padding: '8px 14px', background: input.trim() && !loading ? '#d4af37' : '#e5e7eb', color: '#1a1a2e', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── REGISTRO MENSUAL ──────────────────────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function RegistroMensual({ svcs }: { svcs: Svc[] }) {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const cats = [...new Set(svcs.map(s => s.categoria))].sort()

  useEffect(() => {
    async function load() {
      const { data } = await sb.from('ventas_mes').select('*').eq('mes', mes).eq('anio', anio)
      const map: Record<number, number> = {}
      ;(data || []).forEach((v: VentaMes) => { map[v.servicio_id] = v.cantidad_real })
      setCantidades(map)
    }
    load()
  }, [mes, anio])

  async function guardar() {
    setSaving(true)
    const rows = svcs.map(s => ({ servicio_id: s.id, mes, anio, cantidad_real: cantidades[s.id] || 0 }))
    const { error } = await sb.from('ventas_mes').upsert(rows, { onConflict: 'servicio_id,mes,anio' })
    setSaving(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('✅ Guardado correctamente')
    setTimeout(() => setMsg(''), 3000)
  }

  const computed = svcs.map(s => {
    const cantReal = cantidades[s.id] || 0
    const ingProy = s.pvp * s.sm
    const ingReal = s.pvp * cantReal
    return { ...s, cantReal, ingProy, ingReal, diff: ingReal - ingProy }
  })
  const totalProy = computed.reduce((s, r) => s + r.ingProy, 0)
  const totalReal = computed.reduce((s, r) => s + r.ingReal, 0)
  const cumpl = totalProy > 0 ? totalReal / totalProy : 0

  function exportarReporte() {
    const win = window.open('', '_blank')
    if (!win) return
    const mn = MESES[mes - 1]
    const realColor = totalReal >= totalProy ? '#059669' : '#dc2626'
    const cumplColor = cumpl >= 0.9 ? '#059669' : cumpl >= 0.7 ? '#d97706' : '#dc2626'
    const tablas = cats.map(cat => {
      const filas = computed.filter(s => s.categoria === cat)
      const cp = filas.reduce((s, r) => s + r.ingProy, 0)
      const cr = filas.reduce((s, r) => s + r.ingReal, 0)
      const trs = filas.map(s => {
        const dc = s.diff >= 0 ? '#059669' : '#dc2626'
        const rc = s.ingReal >= s.ingProy ? '#059669' : '#6b7280'
        return `<tr><td>${s.nombre}</td><td>${f$(s.pvp)}</td><td style="color:#6b7280">${s.sm}</td><td style="font-weight:700">${s.cantReal}</td><td>${fint(s.ingProy)}</td><td style="color:${rc};font-weight:600">${fint(s.ingReal)}</td><td style="color:${dc};font-weight:700">${s.diff >= 0 ? '+' : ''}${fint(s.diff)}</td></tr>`
      }).join('')
      const pct = fp(cp > 0 ? cr / cp : 0)
      return `<div class="ch">${cat.toUpperCase()} &nbsp;·&nbsp; Real: ${fint(cr)} / Proy: ${fint(cp)} &nbsp;(${pct})</div><table><thead><tr><th>Servicio</th><th>PVP</th><th>Proy.</th><th>Real</th><th>Ing.Proy.</th><th>Ing.Real</th><th>Diferencia</th></tr></thead><tbody>${trs}</tbody></table>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte ${mn} ${anio}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:24px;color:#1a1a2e;font-size:12px}.hdr{background:#1a1a2e;color:white;padding:16px 20px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.kpi{border:1px solid #e5e7eb;padding:12px;border-radius:8px}.kl{font-size:10px;color:#6b7280;margin-bottom:4px}.kv{font-size:18px;font-weight:800}table{width:100%;border-collapse:collapse;margin-bottom:14px}th{background:#0f3460;color:#d4af37;padding:6px 10px;font-size:10px;text-align:left}td{padding:5px 10px;border-bottom:1px solid #f3f4f6;font-size:11px}.ch{background:#1a1a2e;color:#d4af37;padding:7px 12px;font-size:10px;font-weight:700;margin-top:10px}.ft{text-align:center;color:#9ca3af;font-size:10px;margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb}@media print{button{display:none}}</style></head><body><div class="hdr"><div><div style="color:#d4af37;font-size:18px;font-weight:800">COSMOPOLITAN PELUQUERÍAS</div><div style="color:#9ca3af;margin-top:4px">Reporte Mensual — ${mn} ${anio}</div></div><div style="text-align:right"><div style="color:#d4af37;font-size:11px">NS Consultoría Digital</div><div style="color:#6b7280;font-size:10px">Sistema de Gestión v2.0</div></div></div><div class="kpis"><div class="kpi"><div class="kl">Ingreso Proyectado</div><div class="kv">${fint(totalProy)}</div></div><div class="kpi"><div class="kl">Ingreso Real</div><div class="kv" style="color:${realColor}">${fint(totalReal)}</div></div><div class="kpi"><div class="kl">Cumplimiento</div><div class="kv" style="color:${cumplColor}">${fp(cumpl)}</div></div><div class="kpi"><div class="kl">Diferencia</div><div class="kv" style="color:${realColor}">${totalReal >= totalProy ? '+' : ''}${fint(totalReal - totalProy)}</div></div></div>${tablas}<div class="ft">NS Consultoría Digital · Sistema de Gestión Cosmopolitan · ${mn} ${anio}</div><script>window.onload=function(){window.print()}<\/script></body></html>`
    win.document.write(html)
    win.document.close()
  }

  const th = { background: '#0f3460', color: '#d4af37', padding: '8px 10px', fontSize: 11, fontWeight: 600 as const, textAlign: 'left' as const }
  const td = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid #f3f4f6' }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ background: 'white', borderRadius: 10, padding: '10px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Periodo:</span>
          <select value={mes} onChange={e => setMes(parseInt(e.target.value))}
            style={{ border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: 7, fontSize: 12.5, outline: 'none' }}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(parseInt(e.target.value))}
            style={{ border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: 7, fontSize: 12.5, outline: 'none' }}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={guardar} disabled={saving}
          style={{ padding: '9px 18px', background: '#0f3460', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {saving ? 'Guardando...' : '💾 Guardar registro'}
        </button>
        <button onClick={exportarReporte}
          style={{ padding: '9px 18px', background: '#d4af37', color: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          📄 Exportar Reporte PDF
        </button>
        {msg && <span style={{ fontSize: 12, color: msg.startsWith('✅') ? '#059669' : '#dc2626', fontWeight: 600 }}>{msg}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Ingreso Proyectado', val: fint(totalProy), color: '#1a1a2e' },
          { label: 'Ingreso Real', val: fint(totalReal), color: totalReal >= totalProy ? '#059669' : '#dc2626' },
          { label: 'Cumplimiento', val: fp(cumpl), color: cumpl >= 0.9 ? '#059669' : cumpl >= 0.7 ? '#d97706' : '#dc2626' },
          { label: 'Diferencia', val: `${totalReal >= totalProy ? '+' : ''}${fint(totalReal - totalProy)}`, color: totalReal >= totalProy ? '#059669' : '#dc2626' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {cats.map(cat => {
        const rows = computed.filter(s => s.categoria === cat)
        const catProy = rows.reduce((s, r) => s + r.ingProy, 0)
        const catReal = rows.reduce((s, r) => s + r.ingReal, 0)
        return (
          <div key={cat} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ background: '#1a1a2e', color: '#d4af37', padding: '8px 16px', fontSize: 11, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
              <span>{cat.toUpperCase()}</span>
              <span>Real: {fint(catReal)} / Proy: {fint(catProy)} · {fp(catProy > 0 ? catReal / catProy : 0)}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Servicio','PVP','Cant.Proy.','Cant.Real','Ing.Proyectado','Ing.Real','Diferencia'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id}>
                    <td style={{ ...td, fontWeight: 500 }}>{s.nombre}</td>
                    <td style={td}>{f$(s.pvp)}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{s.sm}</td>
                    <td style={td}>
                      <input type="number" min={0} value={cantidades[s.id] ?? ''}
                        onChange={e => setCantidades(prev => ({ ...prev, [s.id]: parseInt(e.target.value) || 0 }))}
                        style={{ width: 70, border: '1px solid #e5e7eb', padding: '4px 7px', borderRadius: 6, fontSize: 12, outline: 'none' }} />
                    </td>
                    <td style={td}>{fint(s.ingProy)}</td>
                    <td style={{ ...td, fontWeight: 600, color: s.ingReal >= s.ingProy ? '#059669' : '#6b7280' }}>{fint(s.ingReal)}</td>
                    <td style={{ ...td, fontWeight: 600, color: s.diff >= 0 ? '#059669' : '#dc2626' }}>{s.diff >= 0 ? '+' : ''}{fint(s.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
const PAGE_INFO: Record<Page, { t: string; s: string }> = {
  dashboard: { t: 'Dashboard', s: 'Vista general del negocio · 2026' },
  servicios: { t: 'Catálogo de Servicios', s: 'Motor de costeo automático en tiempo real' },
  insumos: { t: 'Insumos y Materias Primas', s: 'Gestión de inventario y costos' },
  packs: { t: 'Crear Packs — Venta Cruzada', s: 'Combina servicios y aumenta el ticket promedio' },
  rentabilidad: { t: 'Análisis de Rentabilidad', s: 'KPIs, alertas y ranking por categoría' },
  registro: { t: 'Registro Mensual', s: 'Ventas reales vs proyectado · Exportar reporte' },
  multiagentes: { t: 'Análisis Multi-Agente IA', s: 'Contador → Administrador → Gerente · Flujo estratégico automático' },
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<Page>('dashboard')
  const [svcs, setSvcs] = useState<Svc[]>([])
  const [ins, setIns] = useState<Ins[]>([])
  const [recs, setRecs] = useState<Rec[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false)
      if (session) loadData()
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) loadData()
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadData() {
    setDataLoading(true)
    const [s, i, r] = await Promise.all([
      sb.from('servicios').select('*').order('id'),
      sb.from('insumos').select('*').order('id'),
      sb.from('recetas').select('*'),
    ])
    setSvcs(s.data || []); setIns(i.data || []); setRecs(r.data || [])
    setDataLoading(false)
  }

  async function doLogout() {
    await sb.auth.signOut(); setSession(null); setSvcs([]); setIns([]); setRecs([])
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e' }}>
      <div style={{ color: '#d4af37', fontSize: 18, fontWeight: 700 }}>Cargando...</div>
    </div>
  )
  if (!session) return <Login onLogin={setSession} />

  const info = PAGE_INFO[page]
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar page={page} setPage={setPage} onLogout={doLogout} email={session.user.email || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '11px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}>{info.t}</h1>
            <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{info.s}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>🟢 En línea</div>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#0f3460', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>NS</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', background: '#f0f2f5' }}>
          {dataLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50%' }}>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Cargando datos de Supabase...</div>
            </div>
          ) : (
            <>
              {page === 'dashboard' && <Dashboard svcs={svcs} ins={ins} recs={recs} />}
              {page === 'servicios' && <Servicios svcs={svcs} setSvcs={setSvcs} ins={ins} recs={recs} />}
              {page === 'insumos' && <Insumos ins={ins} setIns={setIns} />}
              {page === 'packs' && <Packs svcs={svcs} ins={ins} recs={recs} />}
              {page === 'rentabilidad' && <Rentabilidad svcs={svcs} ins={ins} recs={recs} />}
              {page === 'registro' && <RegistroMensual svcs={svcs} />}
              {page === 'multiagentes' && <MultiAgentes svcs={svcs} ins={ins} recs={recs} />}
            </>
          )}
        </div>
      </div>
      {session && <AsistenteIA svcs={svcs} ins={ins} recs={recs} />}
    </div>
  )
}
