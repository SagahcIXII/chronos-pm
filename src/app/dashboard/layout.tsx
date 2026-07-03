'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useLang, LangSwitcher } from '@/lib/i18n'
import { useProject } from '@/lib/projectContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { t, lang } = useLang()
  const { activeProject, loading } = useProject()

  const nav = [
    { href:'/dashboard',        label: t.nav.dashboard },
    { href:'/dashboard/gantt',  label: t.nav.gantt     },
    { href:'/dashboard/curves', label: t.nav.curves    },
    { href:'/dashboard/tasks',  label: t.nav.tasks     },
    { href:'/dashboard/pdf',    label: t.nav.pdf       },
  ]

  const activeLabel = nav.find(n =>
    n.href === '/dashboard' ? path === n.href : path.startsWith(n.href)
  )?.label ?? t.nav.dashboard

  // Guard: enquanto carrega, ou quando o usuário não tem nenhum projeto
  // visível (ex.: cliente sem projeto atribuído), evita render com projeto nulo.
  if (loading || !activeProject) {
    return (
      <div style={{display:'flex',height:'100vh',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14}}>
        <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)'}}>Chronos PM</div>
        {loading ? (
          <span style={{color:'var(--text3)',fontSize:14}}>{lang==='pt'?'Carregando projetos…':'Loading projects…'}</span>
        ) : (
          <>
            <span style={{color:'var(--text3)',fontSize:14}}>{lang==='pt'?'Nenhum projeto disponível para o seu usuário.':'No projects available for your account.'}</span>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>router.push('/projects')}
                style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 14px',cursor:'pointer',color:'var(--text)',fontSize:13}}>
                {lang==='pt'?'Ir para Projetos':'Go to Projects'}
              </button>
              <button onClick={()=>signOut({callbackUrl:'/auth/login'})}
                style={{background:'none',border:'1px solid var(--border)',borderRadius:8,padding:'8px 14px',cursor:'pointer',color:'var(--text3)',fontSize:13}}>
                {lang==='pt'?'Sair':'Sign out'}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  const projectName = lang==='pt' ? activeProject.name : activeProject.nameEn

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>
      <aside style={{width:230,minWidth:230,background:'var(--surface)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column'}}>
        {/* Logo */}
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid var(--border)'}}>
          <div style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:800,color:'var(--text)'}}>Chronos PM</div>
          <div style={{fontSize:10,color:'var(--text3)',letterSpacing:'1.5px',textTransform:'uppercase',marginTop:2}}>
            BD7D Solutions
          </div>
        </div>

        {/* Projeto ativo */}
        <button
          onClick={()=>router.push('/projects')}
          style={{margin:'10px 10px 4px',background:'var(--surface2)',border:`1px solid ${activeProject.color}44`,borderRadius:10,padding:'10px 12px',cursor:'pointer',textAlign:'left',transition:'all 0.2s'}}
          onMouseEnter={e=>(e.currentTarget.style.borderColor=activeProject.color)}
          onMouseLeave={e=>(e.currentTarget.style.borderColor=`${activeProject.color}44`)}
        >
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:9,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'1px'}}>{t.nav.projectLabel}</span>
            <span style={{fontSize:10,color:activeProject.color,fontWeight:700,background:`${activeProject.color}18`,padding:'1px 6px',borderRadius:4}}>{activeProject.code}</span>
          </div>
          <div style={{fontSize:12,fontWeight:600,color:'var(--text)',lineHeight:1.35,marginBottom:4}}>{projectName}</div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{flex:1,background:'var(--border)',borderRadius:2,height:3}}>
              <div style={{background:activeProject.color,width:`${activeProject.progress}%`,height:3,borderRadius:2}}/>
            </div>
            <span style={{fontSize:11,color:activeProject.color,fontWeight:700}}>{activeProject.progress}%</span>
          </div>
          <div style={{fontSize:10,color:'var(--text3)',marginTop:4}}>↗ {lang==='pt'?'Trocar projeto':'Switch project'}</div>
        </button>

        {/* Nav */}
        <nav style={{flex:1,paddingTop:8}}>
          {nav.map(item => {
            const active = item.href==='/dashboard' ? path===item.href : path.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 16px',cursor:'pointer',
                  color:active?'#93c5fd':'var(--text2)',textDecoration:'none',fontSize:13.5,
                  background:active?'rgba(59,130,246,0.1)':'transparent',
                  borderLeft:active?`2px solid ${activeProject.color}`:'2px solid transparent',
                  transition:'all 0.15s'}}>
                {item.label}
              </Link>
            )
          })}
          {(session?.user as any)?.role === 'ADMIN' && (
            <button onClick={()=>router.push('/users')}
              style={{display:'flex',alignItems:'center',gap:10,padding:'9px 16px',cursor:'pointer',width:'100%',
                color:'var(--text2)',background:'none',border:'none',borderLeft:'2px solid transparent',
                fontSize:13.5,textAlign:'left',fontFamily:'inherit'}}>
              👥 {lang==='pt'?'Usuários':'Users'}
            </button>
          )}
        </nav>

        {/* User */}
        <div style={{padding:'12px 16px',borderTop:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#3b82f6,#a855f7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>
              {session?.user?.name?.charAt(0)?? 'U'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:12.5,fontWeight:500,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session?.user?.name??'Usuário'}</p>
              <p style={{fontSize:10.5,color:'var(--text3)'}}>{(session?.user as any)?.role??'Admin'}</p>
            </div>
            <button onClick={()=>signOut({callbackUrl:'/auth/login'})}
              style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16,padding:4,flexShrink:0}} title="Sair">→</button>
          </div>
          <button onClick={()=>router.push('/account')}
            style={{marginTop:8,width:'100%',background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:11.5,textAlign:'left',padding:'2px 0',fontFamily:'inherit'}}>
            🔑 {lang==='pt'?'Trocar senha':'Change password'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <header style={{height:56,background:'var(--surface)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',padding:'0 24px',gap:16,flexShrink:0}}>
          <span style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700,color:'var(--text)'}}>{activeLabel}</span>
          <span style={{width:1,height:20,background:'var(--border)'}}/>
          <span style={{fontSize:12,color:'var(--text3)'}}>{activeProject.code} · {lang==='pt'?activeProject.name.split('—')[0].trim():activeProject.nameEn.split('—')[0].trim()}</span>
          <span style={{flex:1}}/>
          <LangSwitcher />
          <span style={{width:1,height:20,background:'var(--border)'}}/>
          <span className={`badge ${activeProject.status==='IN_PROGRESS'?'badge-blue':activeProject.status==='COMPLETED'?'badge-green':'badge-gray'}`}>
            {lang==='pt'
              ? {IN_PROGRESS:'Em Andamento',COMPLETED:'Concluído',NOT_STARTED:'Não Iniciado',ON_HOLD:'Pausado'}[activeProject.status]
              : {IN_PROGRESS:'In Progress',COMPLETED:'Completed',NOT_STARTED:'Not Started',ON_HOLD:'On Hold'}[activeProject.status]
            }
          </span>
        </header>
        <main style={{flex:1,overflowY:'auto',padding:24}}>{children}</main>
      </div>
    </div>
  )
}
