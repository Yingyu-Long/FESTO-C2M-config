import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { defaults, initial, step } from './simulation'
import type { Mode, Parameters, Snapshot } from './simulation'
import logo from './assets/festo-logo.png'
import './App.css'

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    flow: <><path d="M3 7h13a3 3 0 1 0-3-3M3 12h17M3 17h10a3 3 0 1 1-3 3"/></>,
    pressure: <><path d="M4 19a10 10 0 1 1 16 0M12 13l5-6M6 16h12"/><circle cx="12" cy="13" r="2"/></>,
    total: <><path d="M5 5h14v15H5zM9 2v6M15 2v6M8 12h8M8 16h5"/></>,
    trend: <><path d="M3 4v16h18M5 14l5-5 4 3 6-7"/></>,
    settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="15" cy="17" r="3" fill="white"/></>,
    reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    plug: <><path d="M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></>,
    arrow: <path d="M4 12h16m-5-5 5 5-5 5"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>
}
function Panel({ title, extra, children, className = '' }: { title: string; extra?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><h2>{title}</h2>{extra}</div>{children}</section>
}
const phaseNames = { NORMAL: '正常供气', WAIT: '低流量计时', HOLD: '等待自动使能', SHUTOFF: '切断降压', STANDBY: '待机保压', RISE: '恢复压力' }
const fields: { key: keyof Parameters; title: string; unit: string; register: string; min: number; max: number; step: number }[] = [
  { key: 'threshold', title: '低流量阈值', unit: 'l/min', register: 'Pm.19–20', min: 0, max: 32767, step: 1 },
  { key: 'delay', title: '自动控制延迟', unit: 'min', register: 'Pm.17–18', min: 0, max: 65535, step: 1 },
  { key: 'normal', title: '正常工作压力', unit: 'bar', register: 'Pm.21–22', min: 2.5, max: 10, step: 0.1 },
  { key: 'standby', title: '待机压力', unit: 'bar', register: 'Pm.23–24', min: 2.5, max: 10, step: 0.1 },
  { key: 'userPressure', title: '手动设定压力', unit: 'bar', register: 'Am.2 · Am.0.3–0.4 = 3', min: 2.5, max: 10, step: 0.1 },
  { key: 'price', title: '压缩空气单价', unit: '¥/m³', register: '前端成本计算', min: 0, max: 100, step: 0.01 },
  { key: 'leakLimit', title: '压降提示阈值', unit: 'bar/s', register: '前端演示阈值', min: 0.01, max: 10, step: 0.01 },
]
function App() {
  const [tab, setTab] = useState('overview')
  const [mode, setMode] = useState<Mode>('auto')
  const [enabled, setEnabled] = useState(true)
  const [manualOpen, setManualOpen] = useState(true)
  const [running, setRunning] = useState(true)
  const [idle, setIdle] = useState(false)
  const [params, setParams] = useState<Parameters>(defaults)
  const [draft, setDraft] = useState<Record<keyof Parameters, string>>(() => Object.fromEntries(Object.entries(defaults).map(([k,v]) => [k, String(v)])) as Record<keyof Parameters, string>)
  const [samples, setSamples] = useState<Snapshot[]>([initial])
  const current = samples[samples.length - 1]
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [resetOpen, setResetOpen] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const resetTrigger = useRef<HTMLButtonElement>(null)
  const [error, setError] = useState('')
  const [connection, setConnection] = useState({ host: '192.168.1.10', port: '502', unit: '1', poll: '1000' })
  const [connectionSaved, setConnectionSaved] = useState(false)
  const [metric, setMetric] = useState<'flow' | 'pressure'>('flow')
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setSamples(s => [...s.slice(-59), step(s[s.length - 1], params, mode, enabled, manualOpen, idle)]), 1000)
    return () => clearInterval(timer)
  }, [running, params, mode, enabled, manualOpen, idle])
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  useEffect(() => { if (resetOpen) cancelRef.current?.focus() }, [resetOpen])
  function notify(message: string) { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4000) }
  function updateCurrent(update: Partial<Snapshot>) { setSamples(s => [...s.slice(0, -1), { ...s[s.length - 1], ...update }]) }
  function changeMode(next: Mode) { setMode(next); setManualOpen(true); updateCurrent({ phase: 'NORMAL', elapsed: 0 }); notify(`已切换至 ${next === 'auto' ? 'Auto' : 'User'} Mode（模拟）`) }
  function resetTimer() { updateCurrent({ elapsed: 0, phase: 'RISE' }); notify('Q_low-Timer 已复位，恢复正常压力（模拟）') }
  function saveParameters(e: FormEvent) {
    e.preventDefault()
    const next = Object.fromEntries(Object.entries(draft).map(([k,v]) => [k, Number(v)])) as Parameters
    if (fields.some(f => draft[f.key].trim() === '' || !Number.isFinite(next[f.key]) || next[f.key] < f.min || next[f.key] > f.max)) { setError('请检查参数范围，所有参数均为必填。'); return }
    if (next.normal <= next.standby) { setError('正常工作压力必须大于待机压力。'); return }
    setParams(next); setError(''); notify('参数已应用到本次模拟')
  }
  const valveOpen = mode === 'user' ? manualOpen : current.phase !== 'SHUTOFF'
  const leakEligible = !valveOpen && mode === 'user'
  const leak = leakEligible && -current.delta > params.leakLimit
  const maxY = metric === 'flow' ? Math.max(400, params.threshold * 1.2, ...samples.map(s => s.flow)) : 10
  const chartPoints = samples.map((s,i) => `${44 + i / 59 * 700},${164 - s[metric] / maxY * 140}`).join(' ')
  const dirty = fields.some(f => Number(draft[f.key]) !== params[f.key] || draft[f.key] === '')
  const closeReset = () => { setResetOpen(false); resetTrigger.current?.focus() }
  return <div className="app">
    <header className="topbar"><div className="product"><img src="/dashboard.png" alt=""/><span>Energy Efficiency</span><span className="product-chevron">⌄</span></div><nav aria-label="主导航">{[['overview','设备概览'],['parameters','参数设置'],['connection','通讯配置']].map(([key,label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav><img className="brand" src={logo} alt="Festo"/></header>
    <main><div className="breadcrumb">设备管理 <span>/</span> MSE6-C2M</div><div className="page-heading"><div><div className="eyebrow">COMPRESSED AIR MANAGEMENT</div><h1>MSE6-C2M <span>节能模块</span></h1><p>监测用气状态，控制供气与待机压力。</p></div><div className="heading-actions"><span className="badge demo"><i/>模拟演示</span><button className="button" onClick={() => setRunning(!running)}><Icon name={running ? 'flow' : 'reset'}/>{running ? '暂停模拟' : '继续模拟'}</button></div></div>
    <div className="device-strip"><div><span className={`dot ${running ? '' : 'muted'}`}/><strong>{running ? '模拟运行中' : '模拟已暂停'}</strong><span className="divider"/><span>MSE6-C2M</span><span className="muted-text">节气阀 01</span></div><div><span>Modbus TCP</span><span className="divider"/><span className="muted-text">实机未连接</span><button className="text-button" onClick={() => setTab('connection')}>配置连接 <Icon name="arrow" size={16}/></button></div></div>
    {tab === 'overview' && <>
      <div className="metrics">{[
        { label: '当前流量', value: current.flow.toFixed(1), unit: 'l/min', icon: 'flow', detail: `低流量阈值 ${params.threshold} l/min`, tag: current.flow < params.threshold ? '低于阈值' : '正常用气' },
        { label: '输出压力 p2', value: current.pressure.toFixed(2), unit: 'bar', icon: 'pressure', detail: `目标压力 ${mode === 'user' ? params.userPressure : ['SHUTOFF','STANDBY'].includes(current.phase) ? params.standby : params.normal} bar`, tag: '输出端' },
        { label: '累计耗气量 V0', value: current.consumption.toFixed(3), unit: 'm³', icon: 'total', detail: `估算成本 ¥ ${(current.consumption * params.price).toFixed(2)}`, tag: '本次累计' },
        { label: '压力变化 Δp2', value: `${current.delta > 0 ? '+' : ''}${current.delta.toFixed(2)}`, unit: 'bar/s', icon: 'trend', detail: leak ? '压降超出阈值，请检查管路' : leakEligible ? '切断状态 · 监测压力下降' : '切断后可评估泄漏', tag: leak ? '压降提示' : '模拟压差' },
      ].map(m => <section className="metric-card" key={m.label}><div className="metric-label"><span>{m.label}</span><Icon name={m.icon}/></div><div className="metric-value">{m.value}<span>{m.unit}</span></div><div className="metric-bottom"><span>{m.detail}</span><span className="metric-tag">{m.tag}</span></div></section>)}</div>
      <div className="primary-grid"><Panel title="运行控制" extra={<span className="tiny-label">CONTROL</span>}>
        <div className="control-body"><div className="label-row"><span>控制模式</span><span className="register">Am.0.1</span></div><div className="mode-switch" role="group" aria-label="控制模式"><button className={mode === 'auto' ? 'selected' : ''} onClick={() => changeMode('auto')}><Icon name="settings"/>Auto Mode <small>自动控制</small></button><button className={mode === 'user' ? 'selected' : ''} onClick={() => changeMode('user')}><Icon name="plug"/>User Mode <small>手动控制</small></button></div><p className="control-description">{mode === 'auto' ? '持续低流量时，模块自动切断供气并降至待机压力。' : '由操作人员控制截止阀和压力，模块不做自动切断判断。'}</p>
        {mode === 'auto' ? <><div className="setting-row"><div><strong>自动使能</strong><small>允许低流量超时后切断 · Am.0.5</small></div><button className={`switch ${enabled ? 'on' : ''}`} role="switch" aria-checked={enabled} aria-label="自动使能" onClick={() => setEnabled(!enabled)}><span/></button></div><div className="timer"><div className="label-row"><span>Q_low-Timer</span><strong>{Math.floor(current.elapsed / 60)}:{String(current.elapsed % 60).padStart(2,'0')} <span>/ {params.delay} min</span></strong></div><div className="progress"><div style={{ width: `${Math.min(100,current.elapsed / Math.max(1,params.delay * 60) * 100)}%` }}/></div><div className="timer-foot"><span>{phaseNames[current.phase]}</span><button className="text-button" onClick={resetTimer}><Icon name="reset" size={14}/>复位计时 / 恢复供气</button></div></div></> : <><div className="setting-row"><div><strong>截止阀控制</strong><small>Am.0.0 · 0 供气 / 1 切断</small></div><div className="segmented"><button className={manualOpen ? 'selected' : ''} onClick={() => setManualOpen(true)}>供气</button><button className={!manualOpen ? 'selected' : ''} onClick={() => setManualOpen(false)}>切断</button></div></div><div className="manual-pressure"><span>手动目标压力 <strong>{params.userPressure.toFixed(1)} bar</strong></span><button className="text-button" onClick={() => setTab('parameters')}>调整压力 <Icon name="arrow" size={14}/></button></div></>}
        <div className="control-status"><span className={`dot ${valveOpen ? '' : 'muted'}`}/><strong>截止阀{valveOpen ? '已打开' : '已关闭'}</strong><span className="register">Em.3.0 = {valveOpen ? 0 : 1}</span></div></div>
      </Panel><Panel title="实时趋势" extra={<div className="segmented"><button className={metric === 'flow' ? 'selected' : ''} onClick={() => setMetric('flow')}>流量</button><button className={metric === 'pressure' ? 'selected' : ''} onClick={() => setMetric('pressure')}>压力</button></div>}>
        <div className="chart-meta"><span><i className="legend-line"/>{metric === 'flow' ? '当前流量 (l/min)' : '输出压力 (bar)'}</span><span>最近 60 个采样点 · 1 s / 次</span></div><div className="chart"><svg viewBox="0 0 770 194" role="img" aria-label={`${metric === 'flow' ? '流量' : '压力'}最近60个采样点趋势`}><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0091dc" stopOpacity=".18"/><stop offset="100%" stopColor="#0091dc" stopOpacity=".01"/></linearGradient></defs>{[0,1,2,3,4].map(i => <g key={i}><line x1="44" x2="744" y1={24+i*35} y2={24+i*35} stroke="#e9edef"/><text x="33" y={28+i*35} textAnchor="end">{Math.round(maxY*(1-i/4))}</text></g>)}{metric === 'flow' && <line x1="44" x2="744" y1={164-params.threshold/maxY*140} y2={164-params.threshold/maxY*140} stroke="#e2ad55" strokeDasharray="5 5"/>}<polygon points={`44,164 ${chartPoints} ${44+(samples.length-1)/59*700},164`} fill="url(#chart-fill)"/><polyline points={chartPoints} fill="none" stroke="#0091dc" strokeWidth="2.5"/>{[0,15,30,45,59].map(i => <text key={i} x={44+i/59*700} y="186" textAnchor="middle">{i}s</text>)}</svg></div><div className="chart-footer"><span><span className="dot"/> {running ? '数据持续更新' : '数据已暂停'}</span><span>{metric === 'flow' ? `虚线：低流量阈值 ${params.threshold} l/min` : '压力显示单位：bar'}</span></div>
      </Panel></div>
      <div className="secondary-grid"><Panel title="自动控制参数" extra={<button className="text-button" onClick={() => setTab('parameters')}><Icon name="settings" size={16}/>编辑参数</button>}><div className="parameter-summary">{fields.slice(0,4).map(f => <div key={f.key}><span>{f.title}</span><strong>{params[f.key]} <small>{f.unit}</small></strong><code>{f.register}</code></div>)}</div><div className="panel-note"><Icon name="info" size={16}/>流量持续低于阈值 {params.delay} 分钟且自动使能开启后，执行切断降压。</div></Panel><Panel title="耗气量管理" extra={<span className="tiny-label">CONSUMPTION</span>}><div className="consumption-body"><div><span>累计用气成本</span><strong>¥ {(current.consumption * params.price).toFixed(2)}</strong><small>按 ¥ {params.price.toFixed(2)} / m³ 估算</small></div><button ref={resetTrigger} className="button" onClick={() => setResetOpen(true)}><Icon name="reset" size={16}/>重置耗气量</button></div><div className="panel-note">重置 V0 累计值与对应成本 · Am.0.13</div></Panel></div>
      <div className="simulation-bar"><div><Icon name="info" size={18}/><span>演示场景</span><small>切换用气状态，预览自动控制流程</small></div><div className="segmented"><button className={!idle ? 'selected' : ''} onClick={() => setIdle(false)}>设备运行</button><button className={idle ? 'selected' : ''} onClick={() => setIdle(true)}>设备停机 / 低流量</button></div></div>
    </>}
    {tab === 'parameters' && <Panel title="模块参数" extra={<span className="badge demo">仅应用于模拟</span>}><form onSubmit={saveParameters}><div className="form-intro">设置自动切断条件、工作压力及用气成本。压力以 bar 显示，延迟时间单位为分钟。</div><div className="form-grid">{fields.map(f => <label className="field" key={f.key}><span>{f.title}<code>{f.register}</code></span><div className="input-unit"><input type="number" required min={f.min} max={f.max} step={f.step} value={draft[f.key]} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })}/><span>{f.unit}</span></div><small>范围 {f.min} – {f.max} {f.unit}</small></label>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><span>{dirty ? '有未应用的修改' : '参数已同步至模拟'}</span><button type="button" className="button" onClick={() => { setDraft(Object.fromEntries(Object.entries(params).map(([k,v]) => [k,String(v)])) as Record<keyof Parameters,string>); setError('') }}>撤销修改</button><button className="button primary" type="submit" disabled={!dirty}><Icon name="check" size={17}/>应用参数</button></div></form></Panel>}
    {tab === 'connection' && <div className="connection-grid"><Panel title="Modbus TCP 连接" extra={<span className="badge">未连接</span>}><form onSubmit={e => { e.preventDefault(); setConnectionSaved(true); notify('连接配置已保存在当前页面，尚未连接实机') }}><div className="form-intro">配置未来用于读取过程数据和写入控制指令的设备连接。</div><div className="form-grid"><label className="field"><span>设备 IP / 主机名</span><input required value={connection.host} pattern="[a-zA-Z0-9][a-zA-Z0-9.:-]*" onChange={e => { setConnectionSaved(false); setConnection({ ...connection, host: e.target.value }) }}/></label>{[{key:'port',label:'TCP 端口',min:1,max:65535},{key:'unit',label:'Unit ID',min:0,max:255},{key:'poll',label:'轮询间隔 (ms)',min:100,max:60000}].map(f => <label className="field" key={f.key}><span>{f.label}</span><input type="number" required min={f.min} max={f.max} step="1" value={connection[f.key as keyof typeof connection]} onChange={e => { setConnectionSaved(false); setConnection({ ...connection, [f.key]: e.target.value }) }}/></label>)}</div><div className="form-actions"><span>{connectionSaved ? '配置已保存至当前页面' : '前端配置 · 尚未接入通讯服务'}</span><button type="submit" className="button primary">保存配置</button></div></form></Panel><Panel title="通讯接入说明"><div className="connection-note"><Icon name="plug" size={28}/><h3>前端交互已就绪</h3><p>当前数据与控制操作均为模拟。接入实机需要后端 Modbus TCP 服务。</p><p>Am / Em / Pm 是模块操作数，具体 Modbus 地址、字节序和数值比例需按总线节点映射确认。</p><p>压力变化由可选输入提供；实机泄漏判断需结合切断状态和测量时间。</p></div></Panel></div>}
    <footer><span>FESTO · MSE6-C2M Configuration</span><span>前端演示 · 数据及控制均为模拟</span></footer>
    </main>{toast && <div className="toast" role="status"><Icon name="check" size={18}/>{toast}</div>}
    {resetOpen && <div className="modal-backdrop" onClick={closeReset}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') closeReset(); if (e.key === 'Tab') { e.preventDefault(); const buttons = e.currentTarget.querySelectorAll('button'); (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus() } }}><div className="modal-icon"><Icon name="reset" size={26}/></div><h2 id="reset-title">重置累计耗气量？</h2><p>当前 V0 耗气量为 <strong>{current.consumption.toFixed(3)} m³</strong>。重置后累计值和对应成本归零，瞬时流量不受影响。</p><div className="modal-note">本次操作仅重置模拟数据。</div><div className="modal-actions"><button ref={cancelRef} className="button" onClick={closeReset}>取消</button><button className="button primary" onClick={() => { updateCurrent({ consumption: 0 }); closeReset(); notify('V0 累计耗气量已重置（模拟）') }}>确认重置</button></div></section></div>}
  </div>
}
export default App
