'use client'
import { AreaChart,Area,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer,ReferenceLine,BarChart,Bar } from 'recharts'
import { useLang } from '@/lib/i18n'

const DATA_PT = [
  {period:'Fev/25',plannedCumulative:8, executedCumulative:9,  plannedPeriod:8, executedPeriod:9,  deviation:1  },
  {period:'Mar/25',plannedCumulative:15,executedCumulative:16, plannedPeriod:7, executedPeriod:7,  deviation:1  },
  {period:'Abr/25',plannedCumulative:25,executedCumulative:26, plannedPeriod:10,executedPeriod:10, deviation:1  },
  {period:'Mai/25',plannedCumulative:37,executedCumulative:35, plannedPeriod:12,executedPeriod:9,  deviation:-2 },
  {period:'Jun/25',plannedCumulative:52,executedCumulative:null,plannedPeriod:15,executedPeriod:null,deviation:null},
  {period:'Jul/25',plannedCumulative:65,executedCumulative:null,plannedPeriod:13,executedPeriod:null,deviation:null},
  {period:'Ago/25',plannedCumulative:80,executedCumulative:null,plannedPeriod:15,executedPeriod:null,deviation:null},
  {period:'Set/25',plannedCumulative:95,executedCumulative:null,plannedPeriod:15,executedPeriod:null,deviation:null},
  {period:'Out/25',plannedCumulative:100,executedCumulative:null,plannedPeriod:5,executedPeriod:null,deviation:null},
]
const DATA_EN = [
  {period:'Feb/25',plannedCumulative:8, executedCumulative:9,  plannedPeriod:8, executedPeriod:9,  deviation:1  },
  {period:'Mar/25',plannedCumulative:15,executedCumulative:16, plannedPeriod:7, executedPeriod:7,  deviation:1  },
  {period:'Apr/25',plannedCumulative:25,executedCumulative:26, plannedPeriod:10,executedPeriod:10, deviation:1  },
  {period:'May/25',plannedCumulative:37,executedCumulative:35, plannedPeriod:12,executedPeriod:9,  deviation:-2 },
  {period:'Jun/25',plannedCumulative:52,executedCumulative:null,plannedPeriod:15,executedPeriod:null,deviation:null},
  {period:'Jul/25',plannedCumulative:65,executedCumulative:null,plannedPeriod:13,executedPeriod:null,deviation:null},
  {period:'Aug/25',plannedCumulative:80,executedCumulative:null,plannedPeriod:15,executedPeriod:null,deviation:null},
  {period:'Sep/25',plannedCumulative:95,executedCumulative:null,plannedPeriod:15,executedPeriod:null,deviation:null},
  {period:'Oct/25',plannedCumulative:100,executedCumulative:null,plannedPeriod:5,executedPeriod:null,deviation:null},
]

const tt = {contentStyle:{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)'},formatter:(v:any,n:string)=>[v!=null?v+'%':'—',n]}

export default function CurveSPage() {
  const { lang, t } = useLang()
  const c = t.curves
  const data = lang==='pt' ? DATA_PT : DATA_EN
  const todayRef = lang==='pt' ? 'Mai/25' : 'May/25'

  const getStatus = (d: any) => {
    if (d.executedCumulative===null) return c.statusFuturo
    if (d.deviation!==null && d.deviation<=-2) return c.statusAtrasado
    if (d.deviation!==null && d.deviation>=2) return c.statusAdiantado
    return c.statusNoPrazo
  }
  const getStatusColor = (d: any) => {
    if (d.executedCumulative===null) return 'badge-gray'
    if (d.deviation!==null && d.deviation<=-2) return 'badge-red'
    if (d.deviation!==null && d.deviation>=2) return 'badge-green'
    return 'badge-blue'
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div>
        <h1 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)'}}>{c.title}</h1>
        <p style={{fontSize:13,color:'var(--text3)',marginTop:4}}>{c.subtitle}</p>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:8,fontSize:13,color:'#fbbf24'}}>
        ⚠ {c.alert}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
        {[{label:c.kpi1,value:'37%',color:'#60a5fa'},{label:c.kpi2,value:'35%',color:'#f87171'},{label:c.kpi3,value:'-2%',color:'#f87171'},{label:c.kpi4,value:c.trend,color:'#f87171'}].map(k=>(
          <div key={k.label} className="card" style={{padding:20}}>
            <p style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>{k.label}</p>
            <p style={{fontFamily:'Syne,sans-serif',fontSize:26,fontWeight:800,color:k.color}}>{k.value}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><h2 className="card-title">{c.chartTitle}</h2></div>
        <div style={{padding:'16px 16px 16px 0',height:340}}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{top:10,right:20,left:-10,bottom:0}}>
              <defs>
                <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="period" tick={{fill:'var(--text3)',fontSize:11}} axisLine={{stroke:'var(--border)'}} tickLine={false}/>
              <YAxis tick={{fill:'var(--text3)',fontSize:11}} axisLine={{stroke:'var(--border)'}} tickLine={false} domain={[0,100]} tickFormatter={v=>v+'%'}/>
              <Tooltip {...tt}/>
              <Legend wrapperStyle={{fontSize:12,paddingTop:12}} formatter={(v:string)=><span style={{color:'var(--text2)'}}>{v}</span>}/>
              <ReferenceLine x={todayRef} stroke="var(--red)" strokeWidth={1.5} strokeDasharray="5,4" label={{value:lang==='pt'?'Hoje':'Today',fill:'var(--red)',fontSize:10,position:'top'}}/>
              <Area type="monotone" dataKey="plannedCumulative" name={c.planned} stroke="#3b82f6" strokeWidth={2.5} fill="url(#gP)" dot={{fill:'#3b82f6',r:3}} connectNulls/>
              <Area type="monotone" dataKey="executedCumulative" name={c.executed} stroke="#22c55e" strokeWidth={2.5} fill="url(#gE)" dot={{fill:'#22c55e',r:4}} connectNulls={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card">
          <div className="card-header"><h2 className="card-title">{c.barTitle}</h2></div>
          <div style={{padding:'12px 12px 12px 0',height:220}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={4} margin={{top:5,right:10,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="period" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>v+'%'}/>
                <Tooltip {...tt}/>
                <Legend wrapperStyle={{fontSize:11,paddingTop:8}} formatter={(v:string)=><span style={{color:'var(--text2)'}}>{v}</span>}/>
                <Bar dataKey="plannedPeriod" name={c.planned} fill="#3b82f6" fillOpacity={.7} radius={[2,2,0,0]}/>
                <Bar dataKey="executedPeriod" name={c.executed} fill="#22c55e" fillOpacity={.8} radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2 className="card-title">{c.tableTitle}</h2></div>
          <div className="table-wrap" style={{maxHeight:240,overflowY:'auto'}}>
            <table>
              <thead><tr>{[c.colPeriod,c.colPlanAcum,c.colExecAcum,c.colDesvio,c.colStatus].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>{data.map(d=>(
                <tr key={d.period}>
                  <td style={{fontWeight:600}}>{d.period}</td>
                  <td>{d.plannedCumulative}%</td>
                  <td style={{color:d.executedCumulative!=null?'#4ade80':'var(--text3)'}}>{d.executedCumulative!=null?d.executedCumulative+'%':'—'}</td>
                  <td style={{color:d.deviation==null?'var(--text3)':d.deviation<0?'#f87171':d.deviation>0?'#4ade80':'var(--text2)'}}>{d.deviation!=null?(d.deviation>=0?'+':'')+d.deviation+'%':'—'}</td>
                  <td><span className={`badge ${getStatusColor(d)}`}>{getStatus(d)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
