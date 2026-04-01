'use client'
import { useRef, useState } from 'react'
import { useLang } from '@/lib/i18n'

type Scale = 'days' | 'weeks' | 'months'
const TASKS_DATA = [
  {id:'g1', parentId:null,level:0,isGroup:true, isCritical:true, isMilestone:false,pt:'1. PLANEJAMENTO',        en:'1. PLANNING',             resp:'Equipe BD7D',   pStart:'2025-02-01',pEnd:'2025-02-28',aStart:'2025-02-01',aEnd:'2025-02-26',progress:100,status:'COMPLETED',   preds:[]},
  {id:'t1a',parentId:'g1', level:1,isGroup:false,isCritical:false,isMilestone:false,pt:'1.1 Levantamento inicial',en:'1.1 Initial Survey',      resp:'Eng. Carlos',   pStart:'2025-02-01',pEnd:'2025-02-10',aStart:'2025-02-01',aEnd:'2025-02-09',progress:100,status:'COMPLETED',   preds:[]},
  {id:'t1b',parentId:'g1', level:1,isGroup:false,isCritical:true, isMilestone:false,pt:'1.2 Elaboração projetos', en:'1.2 Project Design',      resp:'Eng. Ana',      pStart:'2025-02-10',pEnd:'2025-02-20',aStart:'2025-02-10',aEnd:'2025-02-18',progress:100,status:'COMPLETED',   preds:['t1a']},
  {id:'t1c',parentId:'g1', level:1,isGroup:false,isCritical:true, isMilestone:true, pt:'1.3 Aprovações regul.',  en:'1.3 Reg. Approvals',      resp:'Eng. Carlos',   pStart:'2025-02-20',pEnd:'2025-02-28',aStart:'2025-02-19',aEnd:'2025-02-26',progress:100,status:'COMPLETED',   preds:['t1b']},
  {id:'g2', parentId:null, level:0,isGroup:true, isCritical:true, isMilestone:false,pt:'2. MOBILIZAÇÃO',          en:'2. MOBILIZATION',         resp:'Equipe BD7D',   pStart:'2025-03-01',pEnd:'2025-03-15',aStart:'2025-03-01',aEnd:'2025-03-17',progress:100,status:'COMPLETED',   preds:['g1']},
  {id:'t2a',parentId:'g2', level:1,isGroup:false,isCritical:false,isMilestone:false,pt:'2.1 Contratação equipe',  en:'2.1 Team Hiring',         resp:'RH',            pStart:'2025-03-01',pEnd:'2025-03-08',aStart:'2025-03-01',aEnd:'2025-03-08',progress:100,status:'COMPLETED',   preds:['t1c']},
  {id:'t2b',parentId:'g2', level:1,isGroup:false,isCritical:true, isMilestone:false,pt:'2.2 Montagem canteiro',   en:'2.2 Site Setup',          resp:'Eng. Pedro',    pStart:'2025-03-08',pEnd:'2025-03-15',aStart:'2025-03-08',aEnd:'2025-03-17',progress:100,status:'COMPLETED',   preds:['t2a']},
  {id:'g3', parentId:null, level:0,isGroup:true, isCritical:true, isMilestone:false,pt:'3. INFRA. CIVIL',          en:'3. CIVIL INFRASTRUCTURE', resp:'Eng. Pedro',    pStart:'2025-03-15',pEnd:'2025-06-30',aStart:'2025-03-17',aEnd:null,        progress:58, status:'IN_PROGRESS', preds:['g2']},
  {id:'t3a',parentId:'g3', level:1,isGroup:false,isCritical:true, isMilestone:false,pt:'3.1 Fundações',            en:'3.1 Foundations',         resp:'Eng. Pedro',    pStart:'2025-03-15',pEnd:'2025-04-15',aStart:'2025-03-17',aEnd:'2025-04-12',progress:100,status:'COMPLETED',   preds:['t2b']},
  {id:'t3b',parentId:'g3', level:1,isGroup:false,isCritical:true, isMilestone:false,pt:'3.2 Estrutura metálica',   en:'3.2 Steel Structure',     resp:'Metalcon',      pStart:'2025-04-15',pEnd:'2025-05-30',aStart:'2025-04-12',aEnd:null,        progress:70, status:'IN_PROGRESS', preds:['t3a']},
  {id:'t3c',parentId:'g3', level:1,isGroup:false,isCritical:true, isMilestone:false,pt:'3.3 Cobertura',            en:'3.3 Roofing',             resp:'Eng. Pedro',    pStart:'2025-05-30',pEnd:'2025-06-30',aStart:null,       aEnd:null,        progress:0,  status:'NOT_STARTED', preds:['t3b']},
  {id:'g4', parentId:null, level:0,isGroup:true, isCritical:true, isMilestone:false,pt:'4. INFRA. ELÉTRICA',        en:'4. ELECTRICAL INFRA.',    resp:'Eng. Ana',      pStart:'2025-04-01',pEnd:'2025-07-31',aStart:'2025-04-01',aEnd:null,        progress:35, status:'IN_PROGRESS', preds:['t3a']},
  {id:'t4a',parentId:'g4', level:1,isGroup:false,isCritical:true, isMilestone:false,pt:'4.1 Subestação MT/BT',      en:'4.1 MV/LV Substation',   resp:'Eng. Ana',      pStart:'2025-04-01',pEnd:'2025-05-01',aStart:'2025-04-01',aEnd:'2025-04-28',progress:100,status:'COMPLETED',   preds:['t3a']},
  {id:'t4b',parentId:'g4', level:1,isGroup:false,isCritical:true, isMilestone:false,pt:'4.2 Distribuição BT',       en:'4.2 LV Distribution',    resp:'Elétrica Norte',pStart:'2025-05-01',pEnd:'2025-06-30',aStart:'2025-04-28',aEnd:null,        progress:40, status:'IN_PROGRESS', preds:['t4a']},
  {id:'t4c',parentId:'g4', level:1,isGroup:false,isCritical:false,isMilestone:false,pt:'4.3 Iluminação',            en:'4.3 Lighting',            resp:'Elétrica Norte',pStart:'2025-06-30',pEnd:'2025-07-31',aStart:null,       aEnd:null,        progress:0,  status:'NOT_STARTED', preds:['t4b']},
  {id:'g5', parentId:null, level:0,isGroup:true, isCritical:true, isMilestone:false,pt:'5. AUTOMAÇÃO',               en:'5. AUTOMATION',           resp:'BD7D Solutions',pStart:'2025-07-01',pEnd:'2025-09-15',aStart:null,       aEnd:null,        progress:0,  status:'NOT_STARTED', preds:['g4']},
  {id:'t5a',parentId:'g5', level:1,isGroup:false,isCritical:true, isMilestone:false,pt:'5.1 SDCD',                  en:'5.1 DCS',                 resp:'Eng. Rocha',    pStart:'2025-07-01',pEnd:'2025-07-31',aStart:null,       aEnd:null,        progress:0,  status:'NOT_STARTED', preds:['t4b']},
  {id:'t5b',parentId:'g5', level:1,isGroup:false,isCritical:true, isMilestone:false,pt:'5.2 IHM e SCADA',            en:'5.2 HMI & SCADA',         resp:'BD7D Solutions',pStart:'2025-07-31',pEnd:'2025-08-31',aStart:null,       aEnd:null,        progress:0,  status:'NOT_STARTED', preds:['t5a']},
  {id:'t5c',parentId:'g5', level:1,isGroup:false,isCritical:true, isMilestone:true, pt:'5.3 Comissionamento',        en:'5.3 Commissioning',       resp:'BD7D Solutions',pStart:'2025-08-31',pEnd:'2025-09-15',aStart:null,       aEnd:null,        progress:0,  status:'NOT_STARTED', preds:['t5b']},
  {id:'t6', parentId:null, level:0,isGroup:false,isCritical:true, isMilestone:true, pt:'6. ENTREGA FINAL',           en:'6. FINAL DELIVERY',       resp:'Eng. Carlos',   pStart:'2025-09-15',pEnd:'2025-09-30',aStart:null,       aEnd:null,        progress:0,  status:'NOT_STARTED', preds:['t5c']},
]

const fmtS = (s: string|null) => s ? new Date(s+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '—'
const isDelayed = (t: any) => t.status!=='COMPLETED' && t.pEnd && t.pEnd < new Date().toISOString().slice(0,10)

export default function GanttPage() {
  const { lang, t } = useLang()
  const g = t.gantt
  const sl = (s: string) => (t.status as any)[s] ?? s
  const [scale, setScale] = useState<Scale>('weeks')
  const [expanded, setExpanded] = useState(new Set(['g1','g2','g3','g4','g5']))
  const [selected, setSelected] = useState<string|null>(null)
  const [search, setSearch] = useState('')
  const chartRef = useRef<HTMLDivElement>(null)

  const TASKS = TASKS_DATA.map(tk => ({...tk, name: lang==='pt' ? tk.pt : tk.en}))

  const visible = TASKS.filter(t => {
    if (t.parentId && !expanded.has(t.parentId)) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const toggle = (id: string) => setExpanded(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })

  const tStart = new Date('2025-01-01')
  const COL_W = scale==='days'?32:scale==='weeks'?72:110
  const PPD = scale==='days'?COL_W:scale==='weeks'?COL_W/7:COL_W/30.44
  const d2x = (s: string|null) => { if(!s) return 0; return Math.round((new Date(s).getTime()-tStart.getTime())/86400000*PPD) }
  const dur2w = (s: string|null,e: string|null) => { if(!s||!e) return 0; return Math.max(6,Math.round((new Date(e).getTime()-new Date(s).getTime())/86400000*PPD)) }
  const todayX = d2x(new Date().toISOString().slice(0,10))
  const totalW = Math.max(1000, d2x('2025-11-01')+60)

  const cols: any[] = []
  const cur = new Date(tStart)
  while (cur < new Date('2025-11-01')) {
    if (scale==='months') {
      const x=d2x(cur.toISOString().slice(0,10)); const next=new Date(cur); next.setMonth(next.getMonth()+1)
      cols.push({key:cur.toISOString(),label:cur.toLocaleDateString(lang==='pt'?'pt-BR':'en-US',{month:'short',year:'2-digit'}),x,w:d2x(next.toISOString().slice(0,10))-x})
      cur.setMonth(cur.getMonth()+1)
    } else if (scale==='weeks') {
      const x=d2x(cur.toISOString().slice(0,10))
      cols.push({key:cur.toISOString(),label:cur.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),x,w:COL_W})
      cur.setDate(cur.getDate()+7)
    } else {
      const x=d2x(cur.toISOString().slice(0,10))
      cols.push({key:cur.toISOString(),label:cur.getDate(),x,w:COL_W})
      cur.setDate(cur.getDate()+1)
    }
  }

  const sel = selected ? TASKS.find(t=>t.id===selected) : null
  const ROW_H = 44, HEADER_H = 48

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 110px)',gap:12}}>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div className="scale-group">
          {(['days','weeks','months'] as Scale[]).map(s=>(
            <button key={s} className={`scale-btn ${scale===s?'active':''}`} onClick={()=>setScale(s)}>
              {({days:g.days,weeks:g.weeks,months:g.months} as any)[s]}
            </button>
          ))}
        </div>
        <input className="form-control" style={{height:32,width:200,fontSize:12}} placeholder={`🔍 ${g.search}`} value={search} onChange={e=>setSearch(e.target.value)}/>
        <button className="btn btn-secondary btn-sm" onClick={()=>setExpanded(new Set(TASKS.filter(t=>t.isGroup).map(t=>t.id)))}>{g.expandAll}</button>
        <button className="btn btn-secondary btn-sm" onClick={()=>setExpanded(new Set())}>{g.collapseAll}</button>
        <div style={{flex:1}}/>
        <div style={{display:'flex',gap:12,fontSize:11.5,color:'var(--text3)',alignItems:'center'}}>
          {[{c:'#3b82f6',l:g.legendPlanned},{c:'#22c55e',l:g.legendExecuted},{c:'#ef4444',l:g.legendDelayed},{c:'#f59e0b',l:g.legendCritical},{c:'#a855f7',l:g.legendMilestone}].map(x=>(
            <div key={x.l} style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:18,height:8,borderRadius:3,background:x.c}}/>{x.l}</div>
          ))}
          <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{height:14,borderLeft:'2px dashed #ef4444'}}/>{g.legendToday}</div>
        </div>
      </div>
      <div style={{display:'flex',flex:1,overflow:'hidden',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12}}>
        <div style={{width:380,minWidth:380,borderRight:'1px solid var(--border)',overflowY:'auto',overflowX:'hidden'}}
          onScroll={e=>{if(chartRef.current) chartRef.current.scrollTop=(e.target as any).scrollTop}}>
          <div style={{display:'grid',gridTemplateColumns:'32px 1fr 72px 72px 44px',padding:'0 12px',height:HEADER_H,alignItems:'center',background:'var(--surface2)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:5}}>
            {['',g.colTask,g.colStart,g.colEnd,'%'].map(h=><div key={h} style={{fontSize:10.5,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</div>)}
          </div>
          {visible.map(task=>{
            const hasKids=TASKS.some(t=>t.parentId===task.id)
            const delayed=isDelayed(task)
            return (
              <div key={task.id}
                style={{display:'grid',gridTemplateColumns:'32px 1fr 72px 72px 44px',paddingLeft:8+task.level*16,paddingRight:12,minHeight:ROW_H,alignItems:'center',borderBottom:'1px solid var(--border)',cursor:'pointer',
                  background:task.id===selected?'rgba(59,130,246,0.1)':task.isGroup?'var(--surface2)':'transparent'}}
                onClick={()=>setSelected(task.id===selected?null:task.id)}>
                <div>{hasKids?<button style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:12}} onClick={e=>{e.stopPropagation();toggle(task.id)}}>{expanded.has(task.id)?'▾':'▸'}</button>:<span style={{width:16,display:'block'}}/>}</div>
                <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0}}>
                  {task.isMilestone&&<span style={{color:'#a855f7',fontSize:11}}>◆</span>}
                  {task.isCritical&&!task.isMilestone&&<span style={{color:'#f59e0b',fontSize:11}}>⚡</span>}
                  <span style={{fontSize:12.5,fontWeight:task.isGroup?700:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:task.isMilestone?'#c084fc':undefined}}>{task.name}</span>
                </div>
                <div style={{fontSize:11,color:'var(--text3)'}}>{fmtS(task.pStart)}</div>
                <div style={{fontSize:11,color:delayed?'var(--red)':'var(--text3)'}}>{fmtS(task.pEnd)}</div>
                <div style={{fontSize:11,fontWeight:500,color:task.progress===100?'#4ade80':delayed?'var(--red)':'var(--text3)'}}>{task.progress}%</div>
              </div>
            )
          })}
        </div>
        <div ref={chartRef} style={{flex:1,overflowX:'auto',overflowY:'auto'}}>
          <div style={{minWidth:totalW,position:'relative'}}>
            <svg width={totalW} height={HEADER_H} style={{display:'block',position:'sticky',top:0,zIndex:4,background:'var(--surface2)',borderBottom:'2px solid var(--border)'}}>
              {cols.map(col=>(<g key={col.key}><line x1={col.x} y1={0} x2={col.x} y2={HEADER_H} stroke="var(--border)" strokeWidth={1}/><text x={col.x+col.w/2} y={HEADER_H/2+4} textAnchor="middle" fill="var(--text3)" fontSize={11} fontFamily="DM Sans,sans-serif">{col.label}</text></g>))}
              <rect x={todayX-1} y={0} width={2} height={HEADER_H} fill="#ef4444" opacity={0.9}/>
            </svg>
            <svg width={totalW} height={Math.max(visible.length*ROW_H,300)} style={{display:'block'}}>
              <defs><marker id="arr" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--text3)"/></marker></defs>
              {cols.map(col=><line key={col.key+'g'} x1={col.x} y1={0} x2={col.x} y2={visible.length*ROW_H} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="2,3"/>)}
              {visible.map((_,i)=>i%2===1&&<rect key={i} x={0} y={i*ROW_H} width={totalW} height={ROW_H} fill="rgba(255,255,255,0.012)"/>)}
              {visible.map((task,i)=>task.id===selected&&<rect key={task.id+'s'} x={0} y={i*ROW_H} width={totalW} height={ROW_H} fill="rgba(59,130,246,0.08)"/>)}
              {visible.map((task,i)=>task.preds.map((predId: string)=>{
                const pi=visible.findIndex(t=>t.id===predId); if(pi<0) return null
                const x1=d2x(visible[pi].pEnd),y1=pi*ROW_H+ROW_H/2,x2=d2x(task.pStart),y2=i*ROW_H+ROW_H/2
                return <path key={`d${predId}${task.id}`} d={`M${x1},${y1} C${x1+24},${y1} ${x2-24},${y2} ${x2},${y2}`} fill="none" stroke="var(--text3)" strokeWidth={1} strokeDasharray="4,3" markerEnd="url(#arr)" opacity={0.4}/>
              }))}
              {visible.map((task,i)=>{
                const y=i*ROW_H; const delayed=isDelayed(task)
                if(task.isMilestone){
                  const mx=d2x(task.pEnd),my=y+ROW_H/2,sz=10
                  return <g key={task.id+'b'} style={{cursor:'pointer'}} onClick={()=>setSelected(task.id===selected?null:task.id)}>
                    <polygon points={`${mx},${my-sz} ${mx+sz},${my} ${mx},${my+sz} ${mx-sz},${my}`} fill="#a855f7" opacity={0.9}/>
                    {task.aEnd&&<polygon points={`${d2x(task.aEnd)},${my-sz*.7} ${d2x(task.aEnd)+sz*.7},${my} ${d2x(task.aEnd)},${my+sz*.7} ${d2x(task.aEnd)-sz*.7},${my}`} fill="#22c55e" opacity={0.7}/>}
                  </g>
                }
                const px=d2x(task.pStart),pw=dur2w(task.pStart,task.pEnd)
                const bc=delayed?'#ef4444':task.isCritical?'#f59e0b':'#3b82f6'
                const PY=task.isGroup?y+ROW_H*.2:y+ROW_H*.18,PH=task.isGroup?ROW_H*.42:ROW_H*.35
                const EY=y+ROW_H*.58,EH=task.isGroup?ROW_H*.2:ROW_H*.25
                const ax=task.aStart?d2x(task.aStart):null
                const aw=ax!==null?task.aEnd?dur2w(task.aStart,task.aEnd):Math.max(4,pw*task.progress/100):null
                return <g key={task.id+'b'} style={{cursor:'pointer'}} onClick={()=>setSelected(task.id===selected?null:task.id)}>
                  <rect x={px} y={PY} width={pw} height={PH} rx={3} fill={bc} opacity={task.isGroup?.5:.85}/>
                  {ax!==null&&aw!==null&&<rect x={ax} y={EY} width={aw} height={EH} rx={2} fill="#22c55e" opacity={.9}/>}
                  {pw>36&&task.progress>0&&<text x={px+5} y={PY+PH*.75} fill="white" fontSize={9.5} fontFamily="DM Sans,sans-serif" opacity={.95}>{task.progress}%</text>}
                  {task.isCritical&&!task.isGroup&&<rect x={px} y={y+ROW_H-3} width={pw} height={2} fill="#f59e0b" opacity={.6}/>}
                </g>
              })}
              <line x1={todayX} y1={0} x2={todayX} y2={visible.length*ROW_H} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6,4" opacity={.9}/>
              <rect x={todayX-18} y={4} width={36} height={16} rx={4} fill="#ef4444" opacity={.85}/>
              <text x={todayX} y={16} textAnchor="middle" fill="white" fontSize={9} fontFamily="DM Sans,sans-serif" fontWeight={600}>{g.legendToday}</text>
              {visible.map((_,i)=><line key={i+'s'} x1={0} y1={(i+1)*ROW_H} x2={totalW} y2={(i+1)*ROW_H} stroke="var(--border)" strokeWidth={0.5}/>)}
            </svg>
          </div>
        </div>
        {sel&&(
          <div style={{width:300,minWidth:300,borderLeft:'1px solid var(--border)',overflowY:'auto',padding:16,display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                  {sel.isCritical&&<span className="badge badge-yellow">⚡ {g.panelCritical}</span>}
                  {sel.isMilestone&&<span className="badge badge-purple">◆ {g.panelMilestone}</span>}
                  {isDelayed(sel)&&<span className="badge badge-red">⏰ {g.panelDelayed}</span>}
                </div>
                <h3 style={{fontSize:13.5,fontWeight:700,color:'var(--text)',lineHeight:1.3}}>{sel.name}</h3>
              </div>
              <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:18,padding:4}}>×</button>
            </div>
            <hr style={{borderColor:'var(--border)'}}/>
            <div>
              <p style={{fontSize:10.5,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>{g.panelProgress}</p>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div className="progress-bar" style={{flex:1,height:8}}><div className={`progress-fill ${sel.progress===100?'progress-green':isDelayed(sel)?'progress-red':'progress-blue'}`} style={{width:sel.progress+'%'}}/></div>
                <span style={{marginLeft:12,fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)'}}>{sel.progress}%</span>
              </div>
            </div>
            <hr style={{borderColor:'var(--border)'}}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[[g.panelResp,sel.resp],[g.panelPlanStart,fmtS(sel.pStart)],[g.panelPlanEnd,fmtS(sel.pEnd)],[g.panelActStart,fmtS(sel.aStart)],[g.panelActEnd,fmtS(sel.aEnd)],'status'].map((item,idx)=>{
                if(item==='status') return (
                  <div key="status">
                    <p style={{fontSize:10.5,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3}}>Status</p>
                    <span className={`badge badge-${sel.status==='COMPLETED'?'green':sel.status==='IN_PROGRESS'?'blue':'gray'}`}>{(t.status as any)[sel.status]??sel.status}</span>
                  </div>
                )
                const [l,v] = item as string[]
                return (
                  <div key={l}>
                    <p style={{fontSize:10.5,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3}}>{l}</p>
                    <p style={{fontSize:13,color:'var(--text)'}}>{v}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
