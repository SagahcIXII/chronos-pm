'use client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useLang } from '@/lib/i18n'

const curveDataPT = [
  {name:'Fev',Planejado:8,Executado:9},{name:'Mar',Planejado:15,Executado:16},
  {name:'Abr',Planejado:25,Executado:26},{name:'Mai',Planejado:37,Executado:35},
  {name:'Jun',Planejado:52,Executado:null},{name:'Jul',Planejado:65,Executado:null},
  {name:'Ago',Planejado:80,Executado:null},{name:'Set',Planejado:95,Executado:null},
  {name:'Out',Planejado:100,Executado:null},
]
const curveDataEN = [
  {name:'Feb',Planned:8,Executed:9},{name:'Mar',Planned:15,Executed:16},
  {name:'Apr',Planned:25,Executed:26},{name:'May',Planned:37,Executed:35},
  {name:'Jun',Planned:52,Executed:null},{name:'Jul',Planned:65,Executed:null},
  {name:'Aug',Planned:80,Executed:null},{name:'Sep',Planned:95,Executed:null},
  {name:'Oct',Planned:100,Executed:null},
]

export default function DashboardPage() {
  const { lang, t } = useLang()
  const d = t.dashboard
  const sl = (s: string) => (t.status as any)[s] ?? s
  const fd = (s: string) => {
    const [y,m,day] = s.split('-')
    return lang==='pt' ? `${day}/${m}/${y}` : `${m}/${day}/${y}`
  }

  const curveData = lang==='pt' ? curveDataPT : curveDataEN
  const dataKey1 = lang==='pt' ? 'Planejado' : 'Planned'
  const dataKey2 = lang==='pt' ? 'Executado' : 'Executed'
  const todayRef = lang==='pt' ? 'Mai' : 'May'

  const phases = [
    {name:lang==='pt'?'1. Planejamento':'1. Planning',           progress:100,status:'COMPLETED',   start:'2025-02-01',end:'2025-02-28'},
    {name:lang==='pt'?'2. Mobilização':'2. Mobilization',         progress:100,status:'COMPLETED',   start:'2025-03-01',end:'2025-03-15'},
    {name:lang==='pt'?'3. Infraestrutura Civil':'3. Civil Infra.',progress:58, status:'IN_PROGRESS', start:'2025-03-15',end:'2025-06-30'},
    {name:lang==='pt'?'4. Infraestrutura Elétrica':'4. Electrical Infra.',progress:35,status:'IN_PROGRESS',start:'2025-04-01',end:'2025-07-31'},
    {name:lang==='pt'?'5. Automação Industrial':'5. Automation',  progress:0,  status:'NOT_STARTED', start:'2025-07-01',end:'2025-09-15'},
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div>
        <h1 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)'}}>{d.title}</h1>
        <p style={{fontSize:13,color:'var(--text3)',marginTop:4}}>{d.subtitle}</p>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:8,fontSize:13,color:'#fbbf24'}}>
        ⚠ {d.alert}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        {[
          {label:d.kpi1Label,value:'14',sub:'6 '+d.kpi1Sub,cls:'blue'},
          {label:d.kpi2Label,value:'42%',sub:d.kpi2Sub,cls:'green'},
          {label:d.kpi3Label,value:'1',sub:'9 '+d.kpi3Sub,cls:'red'},
          {label:d.kpi4Label,value:'3',sub:'1 '+d.kpi4Sub,cls:'purple'},
        ].map(k=>(
          <div key={k.label} className={`kpi-card ${k.cls}`}>
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-value">{k.value}</p>
            <p className="kpi-sub">{k.sub}</p>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card">
          <div className="card-header"><h2 className="card-title">{d.curvaTitle}</h2></div>
          <div style={{padding:'16px 16px 16px 0',height:220}}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curveData} margin={{top:5,right:10,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                <XAxis dataKey="name" tick={{fill:'var(--text3)',fontSize:11}} axisLine={{stroke:'var(--border)'}}/>
                <YAxis tick={{fill:'var(--text3)',fontSize:11}} tickFormatter={v=>v+'%'} axisLine={{stroke:'var(--border)'}}/>
                <Tooltip contentStyle={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)'}} formatter={(v:any,n:string)=>[v+'%',n]}/>
                <ReferenceLine x={todayRef} stroke="var(--red)" strokeDasharray="4,3"/>
                <Area type="monotone" dataKey={dataKey1} stroke="#3b82f6" strokeWidth={2} fill="rgba(59,130,246,0.1)" connectNulls/>
                <Area type="monotone" dataKey={dataKey2} stroke="#22c55e" strokeWidth={2} fill="rgba(34,197,94,0.1)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2 className="card-title">{d.fasesTitle}</h2></div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',gap:14}}>
            {phases.map(p=>(
              <div key={p.name}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:12.5,fontWeight:500,color:'var(--text)'}}>{p.name}</span>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:11,color:'var(--text3)'}}>{p.progress}%</span>
                    <span className={`badge ${p.status==='COMPLETED'?'badge-green':p.status==='IN_PROGRESS'?'badge-blue':'badge-gray'}`}>{sl(p.status)}</span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className={`progress-fill ${p.status==='COMPLETED'?'progress-green':p.progress<20?'progress-red':'progress-blue'}`} style={{width:p.progress+'%'}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h2 className="card-title">{d.resumoTitle}</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr>{[d.colFase,d.colInicio,d.colTermino,d.colProgresso,d.colStatus].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>{phases.map(p=><tr key={p.name}>
              <td style={{fontWeight:600}}>{p.name}</td>
              <td>{fd(p.start)}</td><td>{fd(p.end)}</td>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><div className="progress-bar" style={{flex:1,minWidth:80}}><div className={`progress-fill ${p.status==='COMPLETED'?'progress-green':'progress-blue'}`} style={{width:p.progress+'%'}}/></div><span style={{fontSize:11,color:'var(--text3)'}}>{p.progress}%</span></div></td>
              <td><span className={`badge ${p.status==='COMPLETED'?'badge-green':p.status==='IN_PROGRESS'?'badge-blue':'badge-gray'}`}>{sl(p.status)}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
