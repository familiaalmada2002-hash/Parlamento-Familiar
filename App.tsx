
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Role, User, Proyecto, AppState, Comision, ProjectionMode, Sentencia, Acta, VoteType } from './types';
import { 
  Landmark, Mic2, X, Trash2, Gavel, FileText, Settings, Edit3,
  ListChecks, Newspaper, Check, Maximize, Layout, Scale, 
  ChevronRight, Music, Search, Plus, Flame, Building2, Vote, 
  BookOpen, History, StopCircle, LogOut, Users, Award, Ban, 
  FileSignature, Clock, Sparkles, Loader2, Hammer, ScrollText, ShieldAlert,
  Save, RotateCcw, AlertCircle, FileStack, Timer, Volume2, Shield, Eye, Lock, Unlock
} from 'lucide-react';
import { INITIAL_USERS, SYMBOLS, ESTATUTO_COMPLETO, HIMNOS, GUIA_PRESIDENCIAL, INITIAL_COMMISSIONS } from './constants';
import Gun from 'gun';

const gun = Gun({ peers: ['https://gun-manhattan.herokuapp.com/gun'] });
const db = gun.get('SALA_SUPREMA_FINAL_BOP20_V11');

export default function App() {
  const [isLogged, setIsLogged] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('inicio');
  const [dniInput, setDniInput] = useState('');
  const [fullScreenProj, setFullScreenProj] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Proyecto | null>(null);
  const [estatutoSearch, setEstatutoSearch] = useState('');
  const [editingComision, setEditingComision] = useState<string | null>(null);
  const [customVoteTopic, setCustomVoteTopic] = useState('');
  const [isDoubleVoteEnabled, setIsDoubleVoteEnabled] = useState(false);

  const [state, setState] = useState<AppState>({
    users: [], projects: [], news: [], ordenDia: [], actas: [], comisiones: [],
    sessionStatus: 'NO_INICIADA', sessionType: 'ORDINARIA', sessionNumber: '001',
    candleLit: false, hatOn: false, speakerId: null, speakerTimer: 300, 
    activeVoteTopic: null, manualVotes: { yes: 0, no: 0, abs: 0 }, 
    projectionMode: 'LOGO', currentTime: new Date(), flashMessage: null
  });

  const isPres = useMemo(() => currentUser?.dni === '49993070', [currentUser]);

  useEffect(() => {
    // Sincronizar Global
    db.get('global').on((data) => {
      if (!data) return;
      setState(prev => ({ ...prev, 
        sessionStatus: data.status || 'NO_INICIADA',
        sessionType: data.sessionType || 'ORDINARIA',
        sessionNumber: data.sessionNumber || '001',
        candleLit: !!data.candleLit,
        hatOn: !!data.hatOn,
        speakerId: data.speakerId || null,
        speakerTimer: data.speakerTimer ?? 300,
        activeVoteTopic: data.voteTopic || null,
        projectionMode: (data.projection as ProjectionMode) || 'LOGO',
        manualVotes: data.manualVotes ? JSON.parse(data.manualVotes) : { yes: 0, no: 0, abs: 0 }
      }));
    });

    // Sincronizar Colecciones
    const collections = ['users', 'projects', 'news', 'ordenDia', 'actas', 'comisiones'];
    collections.forEach(key => {
      db.get(key).map().on((val, id) => {
        if (val === null) {
          setState(prev => ({ ...prev, [key]: (prev[key as keyof AppState] as any[]).filter((x:any) => x.id !== id) }));
          return;
        }
        const item = typeof val === 'string' ? JSON.parse(val) : val;
        setState(prev => {
          const arr = (prev[key as keyof AppState] as any[]);
          const others = arr.filter((x:any) => x.id !== id);
          return { ...prev, [key]: [...others, { ...item, id }].sort((a,b) => (a.banca || 0) - (b.banca || 0)) };
        });
      });
    });

    // Cargar comisiones iniciales si no existen
    INITIAL_COMMISSIONS.forEach(c => {
      db.get('comisiones').get(c.id).once((exists) => {
        if (!exists) db.get('comisiones').get(c.id).put(JSON.stringify(c));
      });
    });
  }, []);

  // Notificaciones Flash Unificadas
  useEffect(() => {
    if (!currentUser) return;
    const userInState = state.users.find(u => u.id === currentUser.id);
    if (!userInState) return;

    if (!userInState.notificacionVista) {
      let msg = "";
      if (userInState.pedirPalabra === 'CONCEDIDA') msg = "TE DIERON LA PALABRA";
      else if (userInState.pedirPalabra === 'RECHAZADA') msg = "TE RECHAZARON LA PALABRA";
      else if (userInState.pedirPalabra === 'ESPERE_MINUTOS') msg = "ESPERE UNOS MINUTOS";
      
      if (msg) {
        showFlash(msg);
        db.get('users').get(currentUser.id).put({ notificacionVista: true });
      }
    }
  }, [state.users]);

  // Cronómetro de Oratoria 5 minutos (300 segundos) - Segundo a Segundo
  useEffect(() => {
    const t = setInterval(() => {
      setState(prev => ({ ...prev, currentTime: new Date() }));
      if (isPres && state.speakerId && state.speakerTimer > 0 && state.sessionStatus === 'ABIERTA') {
        db.get('global').get('speakerTimer').put(state.speakerTimer - 1);
      } else if (isPres && state.speakerId && state.speakerTimer <= 0) {
        master.revokeWord(state.speakerId);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [state.speakerId, state.speakerTimer, state.sessionStatus, isPres]);

  const showFlash = (msg: string) => {
    setState(prev => ({ ...prev, flashMessage: msg }));
    setTimeout(() => setState(prev => ({ ...prev, flashMessage: null })), 2000);
  };

  const master = {
    login: () => {
      const user = state.users.find(u => u.dni === dniInput) || INITIAL_USERS.find(u => u.dni === dniInput);
      if (user) {
        if (!user.habilitado) { alert('SANCIONADO: BANCA BLOQUEADA'); return; }
        setCurrentUser(user);
        setIsLogged(true);
        db.get('users').get(user.id).put({ presente: true });
      } else { alert('DOCUMENTO NO REGISTRADO'); }
    },
    logout: () => {
      if (currentUser) db.get('users').get(currentUser.id).put({ presente: false });
      setIsLogged(false);
      setCurrentUser(null);
    },
    requestWord: () => {
      if (!currentUser) return;
      db.get('users').get(currentUser.id).put({ pedirPalabra: 'ESPERA', notificacionVista: false });
    },
    grantWord: (uid: string) => {
      db.get('global').put({ speakerId: uid, speakerTimer: 300, projection: 'USO_PALABRA' });
      db.get('users').get(uid).put({ pedirPalabra: 'CONCEDIDA', notificacionVista: false });
    },
    denyWord: (uid: string) => {
      db.get('users').get(uid).put({ pedirPalabra: 'RECHAZADA', notificacionVista: false });
      setTimeout(() => db.get('users').get(uid).put({ pedirPalabra: 'NINGUNO' }), 3000);
    },
    waitWord: (uid: string) => {
      db.get('users').get(uid).put({ pedirPalabra: 'ESPERE_MINUTOS', notificacionVista: false });
      setTimeout(() => db.get('users').get(uid).put({ pedirPalabra: 'ESPERA' }), 5000);
    },
    revokeWord: (uid: string) => {
      db.get('global').put({ speakerId: null, projection: 'LOGO' });
      db.get('users').get(uid).put({ pedirPalabra: 'NINGUNO' });
    },
    createExpediente: (f: any, type: 'LEY' | 'MOCION') => {
      const id = `${type.toLowerCase()}-${Date.now()}`;
      const data: Proyecto = {
        id, numero: `${type === 'LEY' ? 'EXP' : 'MOC'}-${Date.now().toString().slice(-4)}`,
        titulo: f.titulo, articulado: f.articulado, 
        autor: currentUser?.nombre + ' ' + currentUser?.apellido, 
        autorId: currentUser?.id || 'anon',
        autorDni: currentUser?.dni || '0',
        autorBanca: currentUser?.banca || 0,
        fecha: new Date().toLocaleDateString(), 
        hora: new Date().toLocaleTimeString(),
        tipo: type, 
        estado: (state.sessionStatus === 'CERRADA' || state.sessionStatus === 'PAUSA' || state.sessionStatus === 'CUARTO_INTERMEDIO') ? 'ORDEN_DIA' : 'MESA',
        sellado: false, visado: false
      };
      if (data.estado === 'ORDEN_DIA') db.get('ordenDia').get(id).put(JSON.stringify(data));
      else db.get('projects').get(id).put(JSON.stringify(data));
      alert('Ingresado al Sistema Soberano');
    },
    castVote: (v: VoteType) => {
      if (!currentUser) return;
      db.get('users').get(currentUser.id).put({ votoActual: v, votoDobleEjercido: isPres && isDoubleVoteEnabled });
    },
    finishVote: () => {
      const votes = state.users.reduce((acc, u) => {
        if (u.votoActual === 'YES') acc.yes += (u.votoDobleEjercido ? 2 : 1);
        if (u.votoActual === 'NO') acc.no += 1;
        if (u.votoActual === 'ABSTAIN') acc.abs += 1;
        return acc;
      }, { yes: 0, no: 0, abs: 0 });
      db.get('global').put({ manualVotes: JSON.stringify(votes), voteTopic: null, projection: 'VOTACION_RESULTADO' });
    }
  };

  if (!isLogged) return <LoginView dni={dniInput} setDni={setDniInput} onLogin={master.login} />;

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden font-['Inter'] relative">
      {state.flashMessage && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-2xl animate-in">
           <div className="bg-sky-600 p-24 rounded-[6rem] border-[12px] border-white/20 shadow-[0_0_150px_rgba(14,165,233,1)] animate-bounce">
              <h1 className="text-8xl font-black uppercase text-white italic text-center leading-tight tracking-tighter">{state.flashMessage}</h1>
           </div>
        </div>
      )}

      <aside className="w-80 bg-[#0a1120]/95 backdrop-blur-3xl border-r border-amber-900/20 flex flex-col shadow-2xl z-50 overflow-y-auto custom-scrollbar">
        <div className="p-10 border-b border-amber-900/10 bg-black/40 flex flex-col items-center">
          <img src={SYMBOLS.ARG_SHIELD} className="h-16 w-auto mb-4 drop-shadow-[0_0_20px_rgba(212,175,55,0.4)]" />
          <h1 className="text-sm font-black uppercase gold-gradient-text tracking-[0.2em] text-center leading-tight">SALA SUPREMA<br/>Puerto Esperanza</h1>
        </div>
        
        <div className="p-4 space-y-6 flex-1">
          <NavSection title="Centro de Mando">
             <MenuBtn id="inicio" label="Inicio / Dashboard" icon={<Landmark/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="recinto" label="Mapa del Recinto" icon={<Layout/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="votacion" label="Escrutinio Real" icon={<Vote/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="debate" label="Oratoria" icon={<Mic2/>} active={activeTab} onClick={setActiveTab} />
          </NavSection>

          <NavSection title="Legislativo">
             <MenuBtn id="orden" label="Orden del Día" icon={<ListChecks/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="proyectos" label="Proyectos de Ley" icon={<Scale/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="mociones" label="Mociones" icon={<Award/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="lista" label="Quórum y Lista" icon={<Users/>} active={activeTab} onClick={setActiveTab} />
          </NavSection>

          <NavSection title="Institucional">
             <MenuBtn id="comisiones" label="Autoridades" icon={<Building2/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="estatuto" label="Estatuto Supremo" icon={<BookOpen/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="himnos" label="Himnos Patrios" icon={<Music/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="prensa" label="Prensa Oficial" icon={<Newspaper/>} active={activeTab} onClick={setActiveTab} />
          </NavSection>

          <NavSection title="Registros">
             <MenuBtn id="historico" label="Archivo Histórico" icon={<History/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="actas" label="Actas Digitales" icon={<FileSignature/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="bajas" label="Exclusiones" icon={<Ban/>} active={activeTab} onClick={setActiveTab} />
          </NavSection>

          {isPres && (
            <NavSection title="Administración">
               <MenuBtn id="guia" label="Guía Discurso" icon={<ScrollText/>} active={activeTab} onClick={setActiveTab} />
               <MenuBtn id="proyeccion" label="Estación Proyección" icon={<Maximize/>} active={activeTab} onClick={setActiveTab} />
               <MenuBtn id="etica" label="Tribunal" icon={<Gavel/>} active={activeTab} onClick={setActiveTab} />
               <MenuBtn id="admin" label="Configuración" icon={<Settings/>} active={activeTab} onClick={setActiveTab} />
            </NavSection>
          )}
        </div>
        <button onClick={master.logout} className="p-8 bg-rose-950/20 text-rose-500 font-black uppercase text-xs hover:bg-rose-900 hover:text-white transition-all flex items-center justify-center gap-3 border-t border-white/5"><LogOut size={16}/> Cerrar Sesión</button>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-dark-magno">
        <header className="h-20 bg-[#0a1120]/40 backdrop-blur-2xl border-b border-white/5 px-10 flex items-center justify-between z-40">
           <div className="flex items-center gap-8">
              <SessionBadge status={state.sessionStatus} type={state.sessionType} />
              <div className="flex items-center gap-4">
                 {state.candleLit && <Flame size={24} className="text-amber-500 animate-pulse drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />}
                 {state.hatOn && <Landmark size={24} className="text-sky-500" />}
                 <div className="flex items-center gap-2 bg-amber-500/5 px-4 py-1.5 rounded-full border border-amber-500/20 shadow-gold-soft">
                    <span className="text-amber-500 font-black text-[10px] uppercase italic">QUÓRUM: {state.users.filter(u=>u.presente).length}</span>
                 </div>
              </div>
              {state.speakerId && (
                <div className="flex items-center gap-3 px-6 py-2 bg-sky-600 text-white rounded-full text-xs font-black uppercase italic shadow-premium animate-pulse">
                  <Mic2 size={16}/> {state.users.find(u=>u.id===state.speakerId)?.apellido} ({Math.floor(state.speakerTimer / 60)}:{(state.speakerTimer % 60).toString().padStart(2, '0')})
                </div>
              )}
           </div>
           <div className="flex items-center gap-8">
              <div className="text-right">
                 <p className="text-2xl font-mono font-black gold-gradient-text leading-none">{state.currentTime.toLocaleTimeString()}</p>
                 <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 italic tracking-widest">{currentUser?.apellido} - BANCA {currentUser?.banca}</p>
              </div>
              <button onClick={() => setFullScreenProj(true)} className="p-4 bg-sky-600 text-white rounded-2xl shadow-xl hover:scale-110 transition-all border-b-4 border-sky-900"><Maximize size={24}/></button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
           <div className="max-w-7xl mx-auto space-y-10 pb-40">
              {activeTab === 'inicio' && <DashboardView state={state} user={currentUser!} master={master} setActiveTab={setActiveTab} />}
              {activeTab === 'recinto' && <RecintoView state={state} isPres={isPres} master={master} currentUser={currentUser!} />}
              {activeTab === 'votacion' && <VotacionView state={state} user={currentUser!} isPres={isPres} master={master} customVoteTopic={customVoteTopic} setCustomVoteTopic={setCustomVoteTopic} isDoubleVoteEnabled={isDoubleVoteEnabled} setIsDoubleVoteEnabled={setIsDoubleVoteEnabled} />}
              {activeTab === 'debate' && <OratoriaView state={state} isPres={isPres} master={master} />}
              {activeTab === 'orden' && <OrdenDiaView state={state} isPres={isPres} onSelect={setSelectedProject} />}
              {activeTab === 'proyectos' && <LegislativeView title="Proyectos de Ley" type="LEY" state={state} master={master} onSelect={setSelectedProject} isPres={isPres} user={currentUser!} />}
              {activeTab === 'mociones' && <LegislativeView title="Mociones" type="MOCION" state={state} master={master} onSelect={setSelectedProject} isPres={isPres} user={currentUser!} />}
              {activeTab === 'lista' && <QuorumListaView state={state} isPres={isPres} />}
              {activeTab === 'comisiones' && <ComisionesView state={state} isPres={isPres} setEditingComision={setEditingComision} user={currentUser!} />}
              {activeTab === 'prensa' && <PrensaView state={state} isPres={isPres} />}
              {activeTab === 'estatuto' && <EstatutoView search={estatutoSearch} setSearch={setEstatutoSearch} projects={state.projects} />}
              {activeTab === 'himnos' && <HimnosView master={master} isPres={isPres} />}
              {activeTab === 'historico' && <HistoryView state={state} onSelect={setSelectedProject} />}
              {activeTab === 'actas' && <ActasDigitalesView state={state} isPres={isPres} user={currentUser!} />}
              {activeTab === 'guia' && isPres && <GuiaPresidencialView />}
              {activeTab === 'proyeccion' && isPres && <ProyeccionControlView master={master} state={state} />}
              {activeTab === 'etica' && isPres && <EticaView state={state} />}
              {activeTab === 'admin' && isPres && <AdminView state={state} master={master} />}
              {activeTab === 'bajas' && <BajasView state={state} isPres={isPres} />}
           </div>
        </div>
      </main>

      {selectedProject && <ProjectModal project={selectedProject} isPres={isPres} master={master} onClose={() => setSelectedProject(null)} />}
      {editingComision && <ComisionEditModal comision={state.comisiones.find(c => c.id === editingComision) || { id: editingComision, nombre: 'Nueva Comisión', presidenteId: null, vice1Id: null, vice2Id: null, integrantesIds: [] }} users={state.users} onClose={() => setEditingComision(null)} onSave={(data: any) => { db.get('comisiones').get(editingComision!).put(JSON.stringify({...data, id: editingComision})); setEditingComision(null); }} />}
      {fullScreenProj && <div className="fixed inset-0 z-[6000] bg-black"><ProjectionScreen state={state} time={state.currentTime} onClose={() => setFullScreenProj(false)} /><button onClick={() => setFullScreenProj(false)} className="absolute top-10 right-10 p-6 bg-rose-700/50 hover:bg-rose-700 text-white rounded-full transition-all shadow-xl z-[7000]"><X size={48}/></button></div>}
    </div>
  );
}

// --- Vistas de Dashboard ---

function LoginView({ dni, setDni, onLogin }: any) {
  return (
    <div className="h-screen bg-[#020617] flex items-center justify-center p-10 font-['Inter'] relative overflow-hidden">
       <div className="absolute inset-0 opacity-10"><Landmark size={800} className="absolute -top-20 -left-20 rotate-12 text-amber-500" /></div>
       <div className="w-full max-w-2xl bg-[#0a1120]/60 p-20 rounded-[5rem] border-2 border-amber-600/20 shadow-premium backdrop-blur-3xl flex flex-col items-center space-y-12 animate-in z-10">
          <img src={SYMBOLS.ARG_SHIELD} className="h-40 w-auto drop-shadow-[0_0_50px_rgba(212,175,55,0.4)]" />
          <div className="text-center space-y-4">
             <h1 className="text-5xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Acceso Soberano</h1>
             <p className="text-xs font-black text-slate-500 uppercase tracking-widest italic">Recinto de Sesiones - Puerto Esperanza</p>
          </div>
          <div className="w-full space-y-6">
             <input type="text" value={dni} onChange={e=>setDni(e.target.value)} placeholder="Ingrese D.N.I." className="w-full bg-black/40 p-8 rounded-3xl border border-white/10 text-white font-black text-4xl outline-none focus:border-amber-600 text-center italic" onKeyDown={e=>e.key==='Enter'&&onLogin()} />
             <button onClick={onLogin} className="w-full py-8 bg-amber-600 text-white rounded-[3.5rem] font-black uppercase text-2xl italic border-b-[15px] border-amber-950 shadow-gold-soft active:translate-y-2">Validar en Banca</button>
          </div>
       </div>
    </div>
  );
}

function DashboardView({ state, user, master, setActiveTab }: any) {
  const stats = [
    { label: 'Legisladores Registrados', val: state.users.length, icon: <Users/> },
    { label: 'Proyectos en Mesa', val: state.projects.filter((p:any)=>p.estado==='MESA').length, icon: <Scale/> },
    { label: 'Historial de Sesiones', val: state.actas.length, icon: <History/> },
    { label: 'Alertas de Ética', val: state.users.reduce((acc:number, u:any)=>acc + (u.sanciones || 0), 0), icon: <ShieldAlert/> },
  ];

  return (
    <div className="space-y-10 animate-in">
       <div className="bg-[#0a1120]/60 p-12 rounded-[5rem] border-l-[20px] border-amber-600 shadow-premium relative overflow-hidden backdrop-blur-md">
          <div className="z-10 relative space-y-6">
             <h2 className="text-7xl font-black italic gold-gradient-text uppercase leading-none tracking-tighter">Bienvenido,<br/> {user.nombre} {user.apellido}</h2>
             <p className="text-xl text-slate-400 font-bold uppercase italic">Su banca es la Nº {user.banca}</p>
             <button onClick={master.requestWord} className="px-12 py-5 bg-amber-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-gold-soft hover:scale-105 transition-all italic border-b-8 border-amber-950 flex items-center gap-3">
                <Mic2 size={18}/> Pedir la Palabra
             </button>
          </div>
       </div>

       <div className="grid grid-cols-4 gap-8">
          {[
            { id: 'recinto', label: 'Mapa Recinto', icon: <Layout/>, color: 'bg-amber-600' },
            { id: 'votacion', label: 'Escrutinio Real', icon: <Vote/>, color: 'bg-emerald-600' },
            { id: 'debate', label: 'Oratoria', icon: <Mic2/>, color: 'bg-sky-600' },
            { id: 'orden', label: 'Orden del Día', icon: <ListChecks/>, color: 'bg-indigo-600' },
            { id: 'proyectos', label: 'Proyectos Ley', icon: <Scale/>, color: 'bg-purple-600' },
            { id: 'mociones', label: 'Mociones', icon: <Award/>, color: 'bg-rose-600' },
            { id: 'estatuto', label: 'Estatuto', icon: <BookOpen/>, color: 'bg-slate-700' },
            { id: 'prensa', label: 'Prensa Oficial', icon: <Newspaper/>, color: 'bg-blue-600' },
          ].map(s => (
            <button key={s.id} onClick={() => setActiveTab(s.id)} className={`${s.color} p-10 rounded-[4rem] flex flex-col items-center justify-center text-center space-y-4 shadow-xl hover:scale-105 transition-all border-b-[12px] border-black/20 group`}>
               <div className="p-6 bg-white/20 rounded-[2.5rem] group-hover:scale-110 transition-transform">{React.cloneElement(s.icon as any, { size: 40 })}</div>
               <span className="font-black uppercase italic text-xs tracking-widest">{s.label}</span>
            </button>
          ))}
       </div>

       <div className="grid grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="bg-black/40 p-10 rounded-[3.5rem] border border-white/5 flex flex-col items-center text-center space-y-4 shadow-premium">
               <div className="text-amber-500 opacity-40">{React.cloneElement(s.icon as any, { size: 32 })}</div>
               <p className="text-6xl font-black italic tabular-nums gold-gradient-text">{s.val}</p>
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">{s.label}</p>
            </div>
          ))}
       </div>
    </div>
  );
}

// --- Componentes Legislativos ---

function RecintoView({ state, master, currentUser }: any) {
  return (
    <div className="space-y-12 text-center pb-40 animate-in">
       <h2 className="text-7xl font-black italic uppercase gold-gradient-text tracking-tighter">Mapa del Recinto Soberano</h2>
       <div className="bg-[#0a1120]/60 p-20 rounded-[5rem] border border-amber-900/10 relative flex flex-col items-center shadow-premium backdrop-blur-sm">
          <div className="w-full flex justify-center mb-40 gap-28 scale-125 z-10">
             <Seat banca={2} user={state.users.find((u:any)=>u.banca===2)} label="VICE 1º" isVoting={!!state.activeVoteTopic} />
             <Seat banca={1} user={state.users.find((u:any)=>u.banca===1)} label="PRESIDENCIA" big isVoting={!!state.activeVoteTopic} isPresBanca />
             <Seat banca={3} user={state.users.find((u:any)=>u.banca===3)} label="VICE 2º" isVoting={!!state.activeVoteTopic} />
          </div>
          <div className="grid grid-cols-10 gap-10 w-full px-10 border-t-8 border-white/5 pt-20 relative z-10">
             {Array.from({length: 35}).map((_, i) => {
               const bNum = i + 4;
               const u = state.users.find((x:any) => x.banca === bNum);
               return <Seat key={bNum} banca={bNum} user={u} isVoting={!!state.activeVoteTopic} />;
             })}
          </div>
          <div className="mt-20">
             <button onClick={master.requestWord} className="px-20 py-8 bg-amber-600 text-white rounded-[3.5rem] font-black uppercase text-2xl italic border-b-[15px] border-amber-950 shadow-gold-soft active:translate-y-2">Pedir la Palabra</button>
          </div>
       </div>
    </div>
  );
}

function Seat({ banca, user, label, big, isVoting, isPresBanca }: any) {
  let bgColor = 'bg-white/5 border-white/10 opacity-20';
  let shadow = '';
  if (user) {
    if (isVoting && user.votoActual) {
      if (user.votoActual === 'YES') {
        bgColor = user.votoDobleEjercido ? 'bg-purple-600 border-purple-400' : 'bg-emerald-600 border-emerald-400';
        shadow = 'shadow-[0_0_50px_rgba(16,185,129,0.9)] scale-110';
      } else if (user.votoActual === 'NO') { bgColor = 'bg-rose-700 border-rose-500 shadow-premium scale-110'; }
      else if (user.votoActual === 'ABSTAIN') { bgColor = 'bg-amber-500 border-amber-300 shadow-gold-soft scale-110'; }
    } else {
      if (user.pedirPalabra === 'CONCEDIDA') { bgColor = 'bg-sky-600 border-sky-400 animate-pulse scale-125 shadow-premium'; }
      else if (user.presente) { bgColor = 'bg-[#0f172a] border-white/20 opacity-100 shadow-2xl'; }
      else { bgColor = 'bg-rose-950/20 border-rose-900/40 opacity-40'; }
    }
  }
  return (
    <div className={`flex flex-col items-center ${big ? 'scale-110' : ''} group transition-all duration-700`}>
       {label && <span className="mb-4 text-[10px] font-black text-amber-500 uppercase tracking-widest italic">{label}</span>}
       <div className={`${big ? 'w-36 h-36' : 'w-20 h-20'} rounded-[2.5rem] border-4 flex items-center justify-center transition-all duration-700 ${bgColor} ${shadow}`}>
          <span className={`${big ? 'text-6xl' : 'text-3xl'} font-black italic tabular-nums text-white`}>{banca}</span>
       </div>
       {user && <span className="mt-4 text-[10px] font-black uppercase truncate w-32 text-center italic text-slate-500 group-hover:text-white transition-colors">{user.apellido}</span>}
    </div>
  );
}

function VotacionView({ state, user, isPres, master, customVoteTopic, setCustomVoteTopic, isDoubleVoteEnabled, setIsDoubleVoteEnabled }: any) {
  const currentVote = user?.votoActual;
  const totals = JSON.parse(state.manualVotes as any || '{"yes":0,"no":0,"abs":0}');
  
  return (
    <div className="space-y-12 animate-in text-center">
      <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Votación Nominal Suprema</h2>
      {isPres && !state.activeVoteTopic && (
        <div className="bg-[#0a1120]/60 p-12 rounded-[4rem] border border-amber-600/30 space-y-8 shadow-premium max-w-4xl mx-auto">
          <input value={customVoteTopic} onChange={e=>setCustomVoteTopic(e.target.value)} placeholder="Tópico o Expediente a considerar..." className="w-full bg-black/40 p-10 rounded-3xl border border-white/10 text-white font-black text-3xl outline-none italic" />
          <div className="flex items-center justify-center gap-8 py-4">
             <span className="text-xl font-black uppercase italic text-slate-500">¿Ejercer Facultad de Voto Doble?</span>
             <button onClick={()=>setIsDoubleVoteEnabled(!isDoubleVoteEnabled)} className={`w-24 h-12 rounded-full relative transition-all ${isDoubleVoteEnabled ? 'bg-purple-600 shadow-purple-soft' : 'bg-slate-800'}`}>
                <div className={`absolute top-1 w-10 h-10 rounded-full bg-white transition-all ${isDoubleVoteEnabled ? 'left-13' : 'left-1'}`} />
             </button>
          </div>
          <button onClick={()=>{db.get('global').put({voteTopic:customVoteTopic, projection:'VOTACION_CURSO'}); state.users.forEach((u:any)=>db.get('users').get(u.id).put({votoActual:null, votoDobleEjercido:false}));}} className="w-full py-10 bg-emerald-600 text-white rounded-[3.5rem] font-black uppercase text-3xl italic border-b-[20px] border-emerald-950 active:translate-y-2">Lanzar Escrutinio</button>
        </div>
      )}
      {state.activeVoteTopic && (
        <div className="space-y-12">
          <div className="bg-black/40 p-12 rounded-[5rem] border border-white/10 shadow-premium max-w-6xl mx-auto">
             <h3 className="text-5xl font-black italic text-sky-400 uppercase tracking-tighter mb-12">"{state.activeVoteTopic}"</h3>
             <div className="grid grid-cols-3 gap-8">
                <button onClick={()=>master.castVote('YES')} className={`p-12 rounded-[3.5rem] border-b-[20px] font-black text-4xl uppercase italic transition-all active:translate-y-2 ${currentVote==='YES' ? (isPres && isDoubleVoteEnabled ? 'bg-purple-600 border-purple-900 shadow-purple-soft' : 'bg-emerald-600 border-emerald-900 shadow-gold-soft') : 'bg-slate-800 border-slate-950 text-slate-500'} text-white`}>AFIRMATIVO</button>
                <button onClick={()=>master.castVote('NO')} className={`p-12 rounded-[3.5rem] border-b-[20px] font-black text-4xl uppercase italic transition-all active:translate-y-2 ${currentVote==='NO' ? 'bg-rose-700 border-rose-950 shadow-premium' : 'bg-slate-800 border-slate-950 text-slate-500'} text-white`}>NEGATIVO</button>
                <button onClick={()=>master.castVote('ABSTAIN')} className={`p-12 rounded-[3.5rem] border-b-[20px] font-black text-4xl uppercase italic transition-all active:translate-y-2 ${currentVote==='ABSTAIN' ? 'bg-amber-600 border-amber-950 shadow-gold-soft' : 'bg-slate-800 border-slate-950 text-slate-500'} text-white`}>ABSTENCIÓN</button>
             </div>
             <div className="flex justify-center gap-20 pt-16">
                <div className="text-center"><p className="text-6xl font-black italic gold-gradient-text">{totals.yes}</p><p className="text-xs uppercase text-slate-500">Sí</p></div>
                <div className="text-center"><p className="text-6xl font-black italic text-rose-500">{totals.no}</p><p className="text-xs uppercase text-slate-500">No</p></div>
                <div className="text-center"><p className="text-6xl font-black italic text-amber-500">{totals.abs}</p><p className="text-xs uppercase text-slate-500">Abs</p></div>
             </div>
          </div>
          {isPres && (
             <div className="flex gap-6 justify-center">
                <button onClick={master.finishVote} className="px-24 py-10 bg-rose-700 text-white rounded-[4rem] font-black uppercase text-2xl italic border-b-[15px] border-rose-950 shadow-premium active:translate-y-2">Cerrar Escrutinio</button>
                <button onClick={()=>db.get('global').put({voteTopic:null, projection:'LOGO'})} className="px-12 py-10 bg-slate-800 text-slate-400 rounded-[4rem] font-black uppercase text-2xl italic border-b-[15px] border-slate-950 active:translate-y-2">Cancelar</button>
             </div>
          )}
        </div>
      )}
    </div>
  );
}

function OratoriaView({ state, isPres, master }: any) {
  const waiting = state.users.filter((u: any) => u.pedirPalabra === 'ESPERA');
  return (
    <div className="space-y-12 animate-in text-center">
       <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Control de Oratoria</h2>
       <div className="bg-[#0a1120]/60 p-12 rounded-[5rem] border border-white/5 space-y-10 shadow-premium backdrop-blur-sm max-w-5xl mx-auto">
          <div className="flex flex-col items-center gap-4">
             <p className="text-[10rem] font-mono font-black gold-gradient-text leading-none tabular-nums">
                {Math.floor(state.speakerTimer / 60)}:{(state.speakerTimer % 60).toString().padStart(2, '0')}
             </p>
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 px-10 py-3 bg-rose-950/20 text-rose-500 border border-rose-500/20 rounded-full font-black uppercase italic text-xs">
                   <Volume2 size={16}/> MICROFONO {state.speakerId ? 'ABIERTO' : 'CERRADO'}
                </div>
                {isPres && state.speakerId && (
                   <button onClick={()=>master.revokeWord(state.speakerId!)} className="p-4 bg-rose-700 text-white rounded-full shadow-premium animate-pulse"><StopCircle size={32}/></button>
                )}
             </div>
          </div>
          <div className="space-y-6 pt-10 border-t border-white/5 text-left">
             <h3 className="text-xl font-black italic uppercase text-amber-500 tracking-widest ml-6">Lista de Espera</h3>
             {waiting.length === 0 ? <p className="py-10 opacity-20 italic text-2xl font-black uppercase tracking-tighter text-center">Sin solicitudes pendientes</p> : 
               waiting.map((u: any) => (
                 <div key={u.id} className="bg-black/40 p-8 rounded-[3.5rem] border border-white/5 flex justify-between items-center group transition-all hover:border-sky-600/30">
                    <div className="text-left">
                       <p className="text-4xl font-black uppercase italic text-white tracking-tighter">{u.apellido}, {u.nombre}</p>
                       <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">Banca Nº {u.banca}</p>
                    </div>
                    {isPres && (
                      <div className="flex gap-4">
                         <button onClick={()=>master.grantWord(u.id)} className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] italic border-b-4 border-emerald-950">Conceder</button>
                         <button onClick={()=>master.waitWord(u.id)} className="px-10 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-[10px] italic border-b-4 border-amber-950">Pedir Espera</button>
                         <button onClick={()=>master.denyWord(u.id)} className="px-10 py-4 bg-rose-700 text-white rounded-2xl font-black uppercase text-[10px] italic border-b-4 border-rose-950">Negar</button>
                      </div>
                    )}
                 </div>
               ))
             }
          </div>
       </div>
    </div>
  );
}

function ProjectModal({ project, isPres, onClose }: any) {
  const updateStatus = (status: string) => {
    if (status === 'APROBADO' || status === 'RECHAZADO' || status === 'IMPLEMENTADO' || status === 'ARCHIVADO') {
       db.get('projects').get(project.id).put(JSON.stringify({...project, estado: status}));
       if (project.estado === 'ORDEN_DIA') db.get('ordenDia').get(project.id).put(null);
    } else {
       db.get('projects').get(project.id).put({ estado: status });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-10 overflow-y-auto">
       <div className="bg-[#0a1120] w-full max-w-6xl rounded-[5rem] border-2 border-amber-600/30 p-16 relative shadow-premium flex flex-col gap-10">
          <button onClick={onClose} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all"><X size={60}/></button>
          <div className="space-y-4">
             <div className="flex gap-4 items-center">
                <span className="px-5 py-1 bg-amber-600 text-white rounded-full text-[10px] font-black uppercase italic tracking-widest">{project.numero}</span>
                {project.sellado && <span className="px-5 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase italic">SELLADO</span>}
                {project.visado && <span className="px-5 py-1 bg-sky-600 text-white rounded-full text-[10px] font-black uppercase italic">VISADO</span>}
             </div>
             <h2 className="text-6xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">"{project.titulo}"</h2>
             <p className="text-xs font-bold uppercase text-slate-400 italic">Iniciador: {project.autor} (DNI: {project.autorDni}) | Fecha: {project.fecha} {project.hora}</p>
          </div>
          <div className="bg-black/40 p-12 rounded-[3.5rem] border border-white/5 space-y-6 max-h-[40vh] overflow-y-auto custom-scrollbar text-left">
             <p className="text-4xl font-serif italic text-slate-300 leading-relaxed whitespace-pre-wrap">{project.articulado}</p>
          </div>
          {isPres && (
            <div className="pt-10 border-t border-white/10 grid grid-cols-4 gap-4">
               <button onClick={()=>updateStatus(project.tipo==='LEY'?'IMPLEMENTADO':'APROBADO')} className="py-6 bg-emerald-600 text-white rounded-3xl font-black uppercase text-[10px] italic border-b-8 border-emerald-950">{project.tipo==='LEY'?'Implementar':'Aprobar'}</button>
               <button onClick={()=>updateStatus('RECHAZADO')} className="py-6 bg-rose-700 text-white rounded-3xl font-black uppercase text-[10px] italic border-b-8 border-rose-950">Rechazar</button>
               <button onClick={()=>db.get('projects').get(project.id).put({sellado:true, visado:true})} className="py-6 bg-amber-600 text-white rounded-3xl font-black uppercase text-[10px] italic border-b-8 border-amber-950">Sellar y Visar</button>
               <button onClick={()=>{db.get('global').put({voteTopic:project.titulo, projection:'VOTACION_CURSO'}); onClose();}} className="py-6 bg-sky-600 text-white rounded-3xl font-black uppercase text-[10px] italic border-b-8 border-sky-950">Votar Nominal</button>
            </div>
          )}
       </div>
    </div>
  );
}

function QuorumListaView({ state, isPres }: any) {
  const [f, setF] = useState({ dni: '', nombre: '', apellido: '', banca: 4 });
  return (
    <div className="space-y-12 animate-in text-left">
      <div className="flex justify-between items-center">
         <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Quórum y Legisladores</h2>
         {isPres && (
            <div className="flex gap-4 p-6 bg-black/40 rounded-[3rem] border border-white/10">
               <input value={f.dni} onChange={e=>setF({...f, dni:e.target.value})} placeholder="DNI" className="bg-transparent text-white border-b border-amber-600 w-32 px-4 outline-none" />
               <input value={f.nombre} onChange={e=>setF({...f, nombre:e.target.value})} placeholder="Nombre" className="bg-transparent text-white border-b border-amber-600 w-32 px-4 outline-none" />
               <input value={f.apellido} onChange={e=>setF({...f, apellido:e.target.value})} placeholder="Apellido" className="bg-transparent text-white border-b border-amber-600 w-32 px-4 outline-none" />
               <input value={f.banca} onChange={e=>setF({...f, banca:parseInt(e.target.value)})} type="number" className="bg-transparent text-white border-b border-amber-600 w-16 px-4 outline-none" />
               <button onClick={()=>{if(!f.dni) return; const id=`u-${Date.now()}`; db.get('users').get(id).put(JSON.stringify({...f, id, cargo:Role.LEGISLADOR, presente:false, habilitado:true, sanciones:0, sentencias:[], votoActual:null, pedirPalabra:'NINGUNO', notificacionVista:true})); setF({...f, dni:'', nombre:'', apellido:'', banca:f.banca+1})}} className="p-3 bg-emerald-600 rounded-full"><Plus size={24}/></button>
            </div>
         )}
      </div>
      <div className="bg-[#0a1120]/60 rounded-[5rem] border border-white/5 shadow-premium overflow-hidden backdrop-blur-md">
         <table className="w-full text-left font-black italic uppercase">
            <thead><tr className="bg-white/5 text-amber-500 text-[10px] tracking-widest uppercase"><th className="p-10">Banca</th><th className="p-10">Magistrado</th><th className="p-10">D.N.I.</th><th className="p-10">Estado / Acciones</th></tr></thead>
            <tbody className="divide-y divide-white/5">{state.users.map((u:any) => (<tr key={u.id} className="group hover:bg-white/5 transition-colors"><td className="p-10 text-6xl text-slate-700 group-hover:text-white tabular-nums tracking-tighter">{u.banca}</td><td className="p-10 text-4xl text-slate-100 tracking-tighter">{u.apellido}, {u.nombre}</td><td className="p-10 text-xl text-slate-50 tabular-nums">{u.dni}</td><td className="p-10">
               <div className="flex gap-4">
                  <span onClick={()=>isPres && db.get('users').get(u.id).put({presente:!u.presente})} className={`px-10 py-3 rounded-full text-[10px] italic shadow-premium cursor-pointer ${u.presente ? 'bg-emerald-600 text-white' : 'bg-rose-950 text-rose-500 opacity-40'}`}>{u.presente ? 'PRESENTE' : 'AUSENTE'}</span>
                  {isPres && (
                    <>
                       <button onClick={()=>db.get('users').get(u.id).put({habilitado:!u.habilitado})} className={`p-3 rounded-full ${u.habilitado ? 'bg-sky-700/20 text-sky-500' : 'bg-emerald-700/20 text-emerald-500'}`}>{u.habilitado ? <Unlock size={20}/> : <Lock size={20}/>}</button>
                       <button onClick={()=>db.get('users').get(u.id).put(null)} className="p-3 bg-rose-700/20 text-rose-500 rounded-full"><Trash2 size={20}/></button>
                    </>
                  )}
               </div>
            </td></tr>))}</tbody>
         </table>
      </div>
    </div>
  );
}

function EstatutoView({ search, setSearch, projects }: any) {
  const laws = projects.filter((p:any)=>p.estado === 'IMPLEMENTADO');
  const lines = ESTATUTO_COMPLETO.split('\n').filter(l=>l.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-12 animate-in text-center">
       <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Estatuto Supremo</h2>
       <div className="relative max-w-4xl mx-auto">
          <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-amber-500" size={32} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar artículos por palabra o número..." className="w-full bg-[#0a1120]/80 p-10 pl-24 rounded-[3.5rem] border border-white/10 text-white font-black text-2xl outline-none focus:border-amber-600 shadow-premium italic" />
       </div>
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 bg-[#0a1120]/60 p-16 rounded-[5rem] border border-white/5 shadow-premium backdrop-blur-md max-h-[60vh] overflow-y-auto custom-scrollbar text-left">
             {lines.map((line, i)=>(<p key={i} className={`text-2xl font-serif leading-relaxed mb-6 ${line.includes('Art.') ? 'text-amber-500 font-bold uppercase mt-8 border-b border-white/5 pb-2' : 'text-slate-300 italic'}`}>{line}</p>))}
          </div>
          <div className="bg-[#0a1120]/60 p-12 rounded-[5rem] border border-white/5 shadow-premium backdrop-blur-md text-left">
             <h3 className="text-3xl font-black uppercase gold-gradient-text italic mb-10 border-b border-white/5 pb-4">Digesto de Leyes</h3>
             <div className="space-y-6">
                {laws.map((l:any, i:number) => (<div key={l.id} className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-2"><p className="text-amber-500 font-black italic text-xl">Ley {l.id.slice(-3)}/2026</p><p className="text-xs font-bold text-slate-100 uppercase italic">"{l.titulo}"</p></div>))}
                {laws.length === 0 && <p className="opacity-20 italic text-slate-500">Sin leyes promulgadas aún.</p>}
             </div>
          </div>
       </div>
    </div>
  );
}

function GuiaPresidencialView() {
  return (
    <div className="space-y-12 animate-in text-center">
       <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Guía de Discurso Soberano</h2>
       <div className="bg-[#0a1120]/60 p-16 rounded-[5rem] border border-white/5 shadow-premium backdrop-blur-md max-h-[70vh] overflow-y-auto custom-scrollbar text-left">
          <div className="space-y-16">
             {GUIA_PRESIDENCIAL.split('\n\n').map((section, i) => (
               <div key={i} className="bg-black/40 p-12 rounded-[3.5rem] border border-white/5 space-y-6 shadow-inner relative">
                 <p className="text-3xl font-serif text-slate-300 italic leading-relaxed whitespace-pre-wrap">{section}</p>
                 <span className="absolute -top-6 -left-6 w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center font-black">{i+1}</span>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
}

function ProyeccionControlView({ master, state }: any) {
  const modes: { id: ProjectionMode, label: string, icon: any }[] = [
    { id: 'LOGO', label: 'Escudo Nacional', icon: <Landmark/> },
    { id: 'APERTURA_INST', label: 'Apertura Institucional', icon: <FileStack/> },
    { id: 'VELA_INICIO', label: 'Vela de Sabiduría', icon: <Flame/> },
    { id: 'INVESTIDURA', label: 'Investidura', icon: <Award/> },
    { id: 'HIMNO_NAC', label: 'Himno Nacional', icon: <Music/> },
    { id: 'HIMNO_MIS', label: 'Himno Misiones', icon: <Music/> },
    { id: 'HIMNO_PE', label: 'Himno Esperanza', icon: <Music/> },
    { id: 'ORDEN_DIA_PROY', label: 'Orden del Día', icon: <ListChecks/> },
    { id: 'USO_PALABRA', label: 'Uso Palabra', icon: <Mic2/> },
    { id: 'VOTACION_CURSO', label: 'Votación Curso', icon: <Vote/> },
    { id: 'VOTACION_RESULTADO', label: 'Votación Resultados', icon: <Scale/> },
    { id: 'SANCION_PROY', label: 'Sanción Proyectada', icon: <ShieldAlert/> },
    { id: 'JUICIO_INICIADO', label: 'Juicio Político', icon: <Hammer/> },
    { id: 'SILENCIO', label: 'Minuto de Silencio', icon: <Clock/> },
  ];

  return (
    <div className="space-y-12 animate-in text-center">
       <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Estación de Proyección</h2>
       <div className="grid grid-cols-4 gap-6 max-w-6xl mx-auto">
          {modes.map(m => (
            <button key={m.id} onClick={()=>db.get('global').get('projection').put(m.id)} className={`p-8 rounded-[3rem] border border-white/10 font-black uppercase italic text-[10px] flex items-center gap-4 transition-all shadow-premium ${state.projectionMode === m.id ? 'bg-sky-600 text-white shadow-sky-soft scale-105' : 'bg-black/40 text-slate-500 hover:bg-white/5 hover:text-slate-100'}`}>
               {React.cloneElement(m.icon, { size: 18 })} {m.label}
            </button>
          ))}
       </div>
    </div>
  );
}

function EticaView({ state }: any) {
  const [targetId, setTargetId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [isTrial, setIsTrial] = useState(false);

  const sancionar = (veredicto?: string) => {
    if(!targetId || !motivo) return;
    const user = state.users.find((u:any)=>u.id===targetId);
    if(!user) return;
    
    if (veredicto) {
       // Lógica de Juicio
       const id = `sent-${Date.now()}`;
       db.get('users').get(targetId).get('sentencias').set(JSON.stringify({id, veredicto, detalle:motivo, fecha:new Date().toLocaleDateString(), juez:'PRESIDENCIA'}));
       if (veredicto === 'EXPULSION_DIRECTA') db.get('users').get(targetId).put({habilitado:false});
       db.get('global').put({projection:'JUICIO_INICIADO'});
    } else {
       // Llamado de atención simple
       db.get('users').get(targetId).put({ sanciones: (user.sanciones || 0) + 1 });
       db.get('global').put({ projection: 'SANCION_PROY' });
    }
    alert('Sanción aplicada con éxito.');
    setMotivo(''); setTargetId(''); setIsTrial(false);
  };

  return (
    <div className="space-y-12 animate-in text-center">
       <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Tribunal de Honor y Ética</h2>
       <div className="bg-[#0a1120]/60 p-16 rounded-[5rem] border-2 border-rose-900/40 space-y-10 shadow-premium backdrop-blur-md max-w-5xl mx-auto text-left">
          <div className="flex gap-4 mb-10">
             <button onClick={()=>setIsTrial(false)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs italic border-2 transition-all ${!isTrial ? 'bg-amber-600 border-amber-600 text-white' : 'bg-transparent border-white/10 text-slate-500'}`}>Llamado de Atención</button>
             <button onClick={()=>setIsTrial(true)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs italic border-2 transition-all ${isTrial ? 'bg-rose-700 border-rose-700 text-white' : 'bg-transparent border-white/10 text-slate-500'}`}>Juicio Político</button>
          </div>
          <div className="space-y-4">
             <label className="text-[10px] font-black text-rose-500 uppercase italic ml-4">Magistrado a Juzgar</label>
             <select value={targetId} onChange={e=>setTargetId(e.target.value)} className="w-full bg-black/40 p-8 rounded-3xl border border-white/10 text-white font-black text-xl outline-none appearance-none italic">
                <option value="">Seleccionar del Recinto...</option>
                {state.users.map((u:any) => <option key={u.id} value={u.id}>{u.apellido}, {u.nombre} (Banca {u.banca})</option>)}
             </select>
          </div>
          <div className="space-y-4">
             <label className="text-[10px] font-black text-rose-500 uppercase italic ml-4">Causa / Motivo</label>
             <textarea value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Detalle la falta al decoro o incumplimiento del estatuto..." className="w-full bg-black/40 p-10 rounded-[3.5rem] border border-white/10 text-slate-300 font-serif text-2xl h-48 outline-none" />
          </div>
          {isTrial ? (
             <div className="grid grid-cols-2 gap-4">
                <button onClick={()=>sancionar('EXPULSION_DIRECTA')} className="py-6 bg-rose-900 text-white rounded-3xl font-black uppercase text-[10px] italic border-b-8 border-black">Expulsión Directa</button>
                <button onClick={()=>sancionar('SIN_VOTO_UNA_VEZ')} className="py-6 bg-amber-700 text-white rounded-3xl font-black uppercase text-[10px] italic border-b-8 border-black">Sin Voto 1 Vez</button>
                <button onClick={()=>sancionar('SIN_PALABRA_UNA_VEZ')} className="py-6 bg-amber-900 text-white rounded-3xl font-black uppercase text-[10px] italic border-b-8 border-black">Sin Palabra 1 Vez</button>
                <button onClick={()=>sancionar('INOCENTE')} className="py-6 bg-emerald-600 text-white rounded-3xl font-black uppercase text-[10px] italic border-b-8 border-black">Declarar Inocente</button>
             </div>
          ) : (
             <button onClick={()=>sancionar()} className="w-full py-10 bg-rose-700 text-white rounded-[4rem] font-black uppercase text-2xl italic border-b-[20px] border-rose-950 shadow-gold-soft active:translate-y-2">Aplicar Sanción Directa</button>
          )}
       </div>
    </div>
  );
}

function AdminView({ state, master }: any) {
  const [sessionNum, setSessionNum] = useState(state.sessionNumber);
  const [sessionType, setSessionType] = useState(state.sessionType);

  return (
    <div className="space-y-12 animate-in text-center">
       <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Control Maestro</h2>
       <div className="grid grid-cols-2 gap-10">
          <div className="bg-[#0a1120]/60 p-12 rounded-[5rem] border border-white/5 space-y-10 shadow-premium text-left">
             <h3 className="text-3xl font-black uppercase text-amber-500 italic border-b border-white/5 pb-4">Sesión</h3>
             <div className="grid grid-cols-2 gap-6">
                <input value={sessionNum} onChange={e=>setSessionNum(e.target.value)} className="w-full bg-black/40 p-4 rounded-2xl border border-white/10 text-white font-black" />
                <select value={sessionType} onChange={e=>setSessionType(e.target.value as any)} className="w-full bg-black/40 p-4 rounded-2xl border border-white/10 text-white font-black uppercase italic appearance-none">
                   <option value="ORDINARIA">ORDINARIA</option>
                   <option value="EXTRAORDINARIA">EXTRAORDINARIA</option>
                   <option value="DISCIPLINARIA">DISCIPLINARIA</option>
                </select>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <button onClick={()=>db.get('global').put({status:'ABIERTA', sessionNumber:sessionNum, sessionType:sessionType, projection:'APERTURA_INST'})} className="py-6 bg-emerald-600 text-white rounded-3xl font-black uppercase text-[10px] italic border-b-8 border-emerald-950">Abrir Sesión</button>
                <button onClick={()=>db.get('global').put({status:'CERRADA', projection:'CIERRE_SESION', candleLit:false})} className="py-6 bg-rose-700 text-white rounded-3xl font-black uppercase text-[10px] italic border-b-8 border-rose-950">Cerrar Sesión</button>
             </div>
          </div>
          <div className="bg-[#0a1120]/60 p-12 rounded-[5rem] border border-white/5 space-y-10 shadow-premium text-left">
             <h3 className="text-3xl font-black uppercase text-sky-500 italic border-b border-white/5 pb-4">Símbolos Sagrados</h3>
             <div className="grid grid-cols-2 gap-4">
                <button onClick={()=>db.get('global').put({candleLit:!state.candleLit, projection:'VELA_INICIO'})} className={`py-8 rounded-3xl font-black uppercase text-[10px] italic border-b-8 transition-all ${state.candleLit?'bg-amber-600 border-amber-950 text-white shadow-gold-soft':'bg-slate-800 border-black text-slate-500'}`}><Flame size={24} className="mx-auto mb-2"/> Vela Sabiduría</button>
                <button onClick={()=>db.get('global').put({hatOn:!state.hatOn, projection:'INVESTIDURA'})} className={`py-8 rounded-3xl font-black uppercase text-[10px] italic border-b-8 transition-all ${state.hatOn?'bg-sky-600 border-sky-950 text-white shadow-premium':'bg-slate-800 border-black text-slate-500'}`}><Landmark size={24} className="mx-auto mb-2"/> Gorro Presidencial</button>
             </div>
          </div>
       </div>
    </div>
  );
}

// --- Soporte de Proyección Final ---

function ProjectionScreen({ state, time, onClose }: any) {
  const currentSpeaker = state.users.find((u: any) => u.id === state.speakerId);
  const renderContent = () => {
    switch(state.projectionMode) {
      case 'LOGO': return <img src={SYMBOLS.ARG_SHIELD} className="h-[55rem] w-auto opacity-[0.05] grayscale drop-shadow-2xl" />;
      case 'APERTURA_INST': return (
        <div className="text-center space-y-16 animate-in">
           <h2 className="text-[13rem] font-black uppercase text-[#0a1120] leading-none tracking-tighter">SESIÓN ABIERTA</h2>
           <p className="text-[7rem] font-black text-slate-400 italic leading-none">PARLAMENTO FAMILIAR BOP 20</p>
           <div className="flex justify-center gap-32 pt-24">
              <div className="text-center"><p className="text-5xl font-black uppercase mb-6 opacity-30 tracking-widest">Presidencia</p><p className="text-[9rem] font-black italic gold-gradient-text uppercase leading-none">LISTA 001</p></div>
              <div className="text-center"><p className="text-5xl font-black uppercase mb-6 opacity-30 tracking-widest">Quórum</p><p className="text-[9rem] font-black italic text-emerald-600 uppercase leading-none">ALCANZADO</p></div>
           </div>
        </div>
      );
      case 'VELA_INICIO': return (
        <div className="text-center space-y-12 animate-in">
           <Flame size={500} className="mx-auto text-amber-500 drop-shadow-[0_0_150px_rgba(251,191,36,0.9)] animate-pulse" />
           <h2 className="text-[11rem] font-black uppercase text-[#0a1120]">VELA PARLAMENTARIA</h2>
           <p className="text-7xl font-serif italic text-slate-500 max-w-7xl mx-auto leading-relaxed text-center">Unidad, Respeto e Inicio del Orden Institucional.</p>
        </div>
      );
      case 'INVESTIDURA': return (
        <div className="text-center space-y-16 animate-in">
           <Landmark size={400} className="mx-auto text-sky-800 drop-shadow-premium" />
           <h2 className="text-[11rem] font-black uppercase text-[#0a1120]">INVESTIDURA</h2>
           <p className="text-8xl font-black italic text-sky-600 uppercase tracking-tighter leading-none">SE INVISTE AL PRESIDENTE CON LA AUTORIDAD SOBERANA</p>
        </div>
      );
      case 'HIMNO_NAC': return <HimnoProjection title="HIMNO NACIONAL ARGENTINO" detail="EN HONOR A LA NACIÓN ARGENTINA" color="text-sky-800" />;
      case 'HIMNO_MIS': return <HimnoProjection title="MISIONERITA" detail="EN HONOR A NUESTRA TIERRA ROJA" color="text-emerald-800" />;
      case 'HIMNO_PE': return <HimnoProjection title="HIMNO PUERTO ESPERANZA" detail="IDENTIDAD LOCAL" color="text-amber-700" />;
      case 'ORDEN_DIA_PROY': return (
        <div className="space-y-16 w-full animate-in text-left px-40">
           <h2 className="text-[10rem] font-black uppercase text-[#0a1120] leading-none tracking-tighter border-b-[20px] border-[#0a1120] pb-10">ORDEN DEL DÍA</h2>
           <div className="space-y-10">
              {state.ordenDia.map((p:any, i:number) => (
                <div key={p.id} className="flex gap-10 items-start text-left">
                   <span className="text-7xl font-black text-slate-300 tabular-nums">{i+1}</span>
                   <div className="text-left"><p className="text-7xl font-black uppercase text-[#0a1120] text-left">"{p.titulo}"</p></div>
                </div>
              ))}
           </div>
        </div>
      );
      case 'VOTACION_CURSO': return (
        <div className="space-y-16 w-full animate-in text-center">
           <h2 className="text-[10rem] font-black uppercase text-[#0a1120] leading-none tracking-tighter">VOTACIÓN EN CURSO</h2>
           <p className="text-8xl font-serif italic text-slate-600 mb-24 max-w-7xl mx-auto leading-tight text-center">"{state.activeVoteTopic}"</p>
           <div className="grid grid-cols-10 gap-10">
             {state.users.map((u: any) => {
                let c = 'bg-slate-100 border-slate-200';
                if (u.votoActual === 'YES') c = u.votoDobleEjercido ? 'bg-purple-600 border-purple-400 text-white shadow-gold-soft' : 'bg-emerald-600 border-emerald-400 text-white shadow-premium';
                if (u.votoActual === 'NO') c = 'bg-rose-700 border-rose-500 text-white shadow-premium';
                if (u.votoActual === 'ABSTAIN') c = 'bg-amber-500 border-amber-300 text-white shadow-gold-soft';
                return <div key={u.id} className={`w-32 h-32 rounded-[2.5rem] border-8 flex items-center justify-center text-6xl font-black transition-all ${c}`}>{u.banca}</div>;
             })}
           </div>
        </div>
      );
      case 'VOTACION_RESULTADO': return (
        <div className="text-center space-y-20 animate-in">
           <h2 className="text-[14rem] font-black uppercase text-[#0a1120] leading-none tracking-tighter">ESCRUTINIO REAL</h2>
           <div className="grid grid-cols-3 gap-24 max-w-[90vw] mx-auto">
              <div className="bg-emerald-50 p-24 rounded-[7rem] border-[15px] border-emerald-200 shadow-premium"><p className="text-6xl font-black text-emerald-800 mb-10 tracking-widest">AFIRMATIVOS</p><p className="text-[20rem] font-black text-emerald-600 leading-none tabular-nums tracking-tighter">{JSON.parse(state.manualVotes as any || '{"yes":0}').yes}</p></div>
              <div className="bg-rose-50 p-24 rounded-[7rem] border-[15px] border-rose-200 shadow-premium"><p className="text-6xl font-black text-rose-800 mb-10 tracking-widest">NEGATIVOS</p><p className="text-[20rem] font-black text-rose-600 leading-none tabular-nums tracking-tighter">{JSON.parse(state.manualVotes as any || '{"no":0}').no}</p></div>
              <div className="bg-amber-50 p-24 rounded-[7rem] border-[15px] border-amber-200 shadow-premium"><p className="text-6xl font-black text-amber-800 mb-10 tracking-widest">ABSTENCIONES</p><p className="text-[20rem] font-black text-amber-600 leading-none tabular-nums tracking-tighter">{JSON.parse(state.manualVotes as any || '{"abs":0}').abs}</p></div>
           </div>
        </div>
      );
      case 'USO_PALABRA': return (
        <div className="text-center space-y-24 animate-in">
           <Mic2 size={450} className="mx-auto text-sky-800 animate-pulse drop-shadow-premium" />
           <h2 className="text-[14rem] font-black uppercase text-[#0a1120] leading-none tracking-tighter">USO DE LA PALABRA</h2>
           <p className="text-[12rem] font-black text-sky-600 uppercase italic leading-none tracking-tighter">{currentSpeaker?.apellido || 'CÁMARA LIBRE'}</p>
        </div>
      );
      case 'SANCION_PROY': return (
        <div className="text-center space-y-20 animate-in">
           <ShieldAlert size={450} className="mx-auto text-rose-800 animate-pulse" />
           <h2 className="text-[12rem] font-black uppercase text-rose-800 tracking-tighter leading-none">SANCIÓN APLICADA</h2>
        </div>
      );
      case 'JUICIO_INICIADO': return (
        <div className="text-center space-y-20 animate-in">
           <Hammer size={450} className="mx-auto text-[#0a1120] animate-bounce" />
           <h2 className="text-[12rem] font-black uppercase text-[#0a1120] tracking-tighter leading-none">JUICIO POLÍTICO</h2>
           <p className="text-8xl font-black text-rose-800 italic uppercase">DEFENSA DE LA ÉTICA PARLAMENTARIA</p>
        </div>
      );
      case 'CIERRE_SESION': return (
        <div className="text-center space-y-24 animate-in">
           <h2 className="text-[14rem] font-black uppercase text-[#0a1120] leading-none tracking-tighter">SESIÓN LEVANTADA</h2>
           <p className="text-8xl font-black italic text-slate-400">QUE DIOS Y LA PATRIA LO DEMANDEN</p>
        </div>
      );
      default: return <img src={SYMBOLS.ARG_SHIELD} className="h-[50rem] w-auto opacity-[0.05] grayscale" />;
    }
  };

  return (
    <div className="w-full h-full bg-white text-[#0a1120] flex flex-col p-24 relative overflow-hidden font-['Inter']">
       <header className="flex justify-between items-start border-b-[30px] border-[#0a1120] pb-24 mb-24 relative z-10 text-left">
          <div className="flex items-center gap-20 text-left">
             <img src={SYMBOLS.ARG_SHIELD} className="h-56 w-auto" />
             <div className="text-left">
                <h1 className="text-[9rem] font-black uppercase leading-none tracking-tighter mb-6 text-left">Parlamento Familiar</h1>
                <p className="text-6xl font-black text-slate-400 uppercase tracking-[0.4em] italic leading-none text-left">CENTRO DE ESTUDIANTES BOP Nº 20 - LISTA 001</p>
             </div>
          </div>
          <div className="text-right"><p className="text-[13rem] font-mono font-black text-[#0a1120] leading-none mb-6 tabular-nums tracking-tighter text-right">{time.toLocaleTimeString()}</p></div>
       </header>
       <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          {renderContent()}
       </div>
    </div>
  );
}

function HimnoProjection({ title, detail, color }: any) {
  return (
    <div className="text-center space-y-24 animate-in">
       <Music size={500} className={`mx-auto ${color} drop-shadow-premium`} />
       <h2 className={`text-[14rem] font-black uppercase ${color} leading-none tracking-tighter`}>{title}</h2>
       <p className="text-[9rem] font-black italic text-slate-300 uppercase leading-none">{detail}</p>
       <p className="text-7xl font-black text-rose-700 animate-bounce pt-24 tracking-[0.3em]">TODOS DE PIE</p>
    </div>
  );
}

// --- Otros Componentes ---

function NavSection({ title, children }: any) {
  return (
    <div className="space-y-4">
       <p className="text-[8px] font-black text-amber-500/40 uppercase tracking-[0.4em] ml-6 italic">{title}</p>
       <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function MenuBtn({ id, label, icon, active, onClick }: any) {
  const isActive = active === id;
  return (
    <button onClick={() => onClick(id)} className={`w-full flex items-center gap-5 px-6 py-4 rounded-3xl text-[10px] font-black uppercase transition-all group ${isActive ? 'bg-amber-600 text-white shadow-gold-soft scale-105 translate-x-2' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}>
      {React.cloneElement(icon, { size: 18 })} 
      <span className="tracking-[0.2em] italic">{label}</span>
    </button>
  );
}

function SessionBadge({ status, type }: any) {
  const colors: any = { 'ABIERTA': 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10', 'CERRADA': 'text-rose-600 border-rose-600/30 bg-rose-600/10', 'CUARTO_INTERMEDIO': 'text-amber-500 border-amber-500/30 bg-amber-500/10', 'PAUSA': 'text-blue-500 border-blue-500/30 bg-blue-500/10', 'NO_INICIADA': 'text-slate-500 border-slate-500/30 bg-slate-500/10' };
  return <div className={`px-6 py-2 rounded-full border-2 font-black uppercase text-[9px] tracking-[0.2em] italic ${colors[status] || 'text-slate-500'} shadow-sm`}>SESIÓN {status.replace('_', ' ')} | {type}</div>;
}

function ComisionEditModal({ comision, users, onClose, onSave }: any) {
  const [f, setF] = useState({ ...comision });
  return (
    <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-10 overflow-y-auto">
       <div className="bg-[#0a1120] w-full max-w-4xl rounded-[5rem] border-2 border-amber-600/30 shadow-premium p-16 space-y-12 animate-in text-left">
          <h2 className="text-6xl font-black italic gold-gradient-text uppercase text-center tracking-tighter">Estructura de Sala</h2>
          <div className="space-y-8 text-left">
             <input value={f.nombre} onChange={e=>setF({...f, nombre: e.target.value})} placeholder="Nombre de la Sala..." className="w-full bg-black/40 p-10 rounded-3xl border border-white/10 text-white font-black text-3xl outline-none" />
             <div className="grid grid-cols-1 gap-6">
                <select value={f.presidenteId || ''} onChange={e=>setF({...f, presidenteId: e.target.value})} className="w-full bg-black/40 p-8 rounded-3xl border border-white/10 text-white font-bold italic appearance-none text-xl"><option value="">Presidente de Sala...</option>{users.map((u:any) => <option key={u.id} value={u.id}>{u.apellido}, {u.nombre}</option>)}</select>
                <select value={f.vice1Id || ''} onChange={e=>setF({...f, vice1Id: e.target.value})} className="w-full bg-black/40 p-8 rounded-3xl border border-white/10 text-white font-bold italic appearance-none text-xl"><option value="">Vicepresidente 1º...</option>{users.map((u:any) => <option key={u.id} value={u.id}>{u.apellido}, {u.nombre}</option>)}</select>
                <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-amber-500 ml-4 italic">Designar Miembros de Sala:</p>
                    <div className="grid grid-cols-4 gap-4 p-6 bg-black/40 rounded-3xl border border-white/10 max-h-40 overflow-y-auto custom-scrollbar">
                        {users.map((u: any) => (
                            <label key={u.id} className="flex items-center gap-3 text-[10px] font-black uppercase italic cursor-pointer">
                                <input type="checkbox" checked={f.integrantesIds?.includes(u.id)} onChange={e => {
                                    const ids = f.integrantesIds || [];
                                    setF({...f, integrantesIds: e.target.checked ? [...ids, u.id] : ids.filter(x => x !== u.id)});
                                }} className="w-5 h-5 accent-emerald-500" />
                                <span>{u.apellido}</span>
                            </label>
                        ))}
                    </div>
                </div>
             </div>
             <div className="flex gap-8 pt-6">
                <button onClick={() => onSave(f)} className="flex-1 py-10 bg-emerald-600 text-white rounded-[4rem] font-black uppercase text-3xl italic border-b-[20px] border-emerald-950 active:translate-y-2 shadow-gold-soft">Guardar Estructura Suprema</button>
                <button onClick={onClose} className="px-16 py-10 bg-slate-800 text-slate-400 rounded-[4rem] font-black uppercase text-3xl italic border-b-[20px] border-slate-950">Cancelar</button>
             </div>
          </div>
       </div>
    </div>
  );
}

function OrdenDiaView({ state, onSelect }: any) {
  return (
    <div className="space-y-12 animate-in text-left">
       <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Orden del Día</h2>
       <div className="grid grid-cols-1 gap-8">
          {state.ordenDia.map((p: any) => (
            <div key={p.id} onClick={() => onSelect(p)} className="bg-[#0a1120]/60 p-12 rounded-[5rem] border-l-[15px] border-amber-600 shadow-premium cursor-pointer hover:bg-white/5 transition-all text-left">
               <div className="flex justify-between items-center mb-6 text-left">
                  <span className="px-5 py-1 bg-amber-600 text-white rounded-full text-[10px] font-black uppercase italic tracking-widest">{p.numero}</span>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic"><span>{p.fecha}</span> | <span>Autor: {p.autor}</span></div>
               </div>
               <h3 className="text-5xl font-black italic uppercase text-slate-100 leading-tight text-left">"{p.titulo}"</h3>
            </div>
          ))}
          {state.ordenDia.length === 0 && <p className="text-center py-40 opacity-20 italic text-5xl font-black uppercase tracking-tighter">Sin puntos para hoy</p>}
       </div>
    </div>
  );
}

function LegislativeView({ title, type, state, master, onSelect, isPres, user }: any) {
  const items = state.projects.filter((p: any) => p.tipo === type && (p.estado === 'MESA' || p.estado === 'EN_TRATAMIENTO'));
  const [f, setF] = useState({ titulo: '', articulado: '' });
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="space-y-12 animate-in text-left">
       <div className="flex justify-between items-center">
          <h2 className="text-7xl font-black italic gold-gradient-text tracking-tighter uppercase leading-none">{title}</h2>
          <button onClick={() => setShowAdd(!showAdd)} className="p-6 bg-sky-600 rounded-3xl shadow-xl hover:scale-110 transition-all border-b-8 border-sky-950"><Plus size={32}/></button>
       </div>
       {showAdd && (
         <div className="bg-[#0a1120]/80 p-12 rounded-[4rem] border-2 border-sky-600/30 space-y-8 shadow-premium backdrop-blur-xl">
            <input value={f.titulo} onChange={e=>setF({...f, titulo: e.target.value})} placeholder="Encabezado del Expediente..." className="w-full bg-black/40 p-8 rounded-3xl border border-white/10 text-white font-bold text-2xl outline-none" />
            <textarea value={f.articulado} onChange={e=>setF({...f, articulado: e.target.value})} placeholder="Articulado detallado..." className="w-full bg-black/40 p-8 rounded-3xl border border-white/10 text-slate-300 font-serif text-2xl h-60 outline-none" />
            <button onClick={() => { master.createExpediente(f, type); setF({titulo:'', articulado:''}); setShowAdd(false); }} className="w-full py-8 bg-emerald-600 text-white rounded-[3.5rem] font-black uppercase text-2xl italic border-b-[15px] border-emerald-950 active:translate-y-2">Oficializar e Ingresar</button>
         </div>
       )}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {items.map((p: any) => (
            <div key={p.id} onClick={() => onSelect(p)} className="bg-[#0a1120]/60 p-12 rounded-[5rem] border border-white/5 space-y-6 shadow-premium relative group cursor-pointer hover:border-amber-600/30 transition-all text-left">
               <div className="flex justify-between items-start text-left">
                  <span className="px-5 py-1 bg-amber-600/20 text-amber-500 rounded-full text-[10px] font-black uppercase italic tracking-widest">{p.numero}</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase italic">{p.fecha}</span>
               </div>
               <h3 className="text-4xl font-black italic uppercase text-slate-100 tracking-tighter leading-tight text-left">"{p.titulo}"</h3>
               <div className="pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase italic text-slate-500">
                  <span>Autor: {p.autor} (B{p.autorBanca})</span>
                  <ChevronRight size={16} className="text-amber-500" />
               </div>
            </div>
          ))}
       </div>
    </div>
  );
}

function HistoryView({ state, onSelect }: any) {
  const filtered = state.projects.filter((p: any) => p.estado === 'APROBADO' || p.estado === 'RECHAZADO' || p.estado === 'IMPLEMENTADO' || p.estado === 'ARCHIVADO');
  return (
    <div className="space-y-12 animate-in text-left">
       <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none text-center">Archivo Histórico</h2>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {filtered.map((h: any) => (
            <div key={h.id} onClick={() => onSelect(h)} className={`bg-[#0a1120]/60 p-12 rounded-[5rem] border-l-[15px] ${h.estado === 'RECHAZADO' ? 'border-rose-700' : 'border-emerald-600'} space-y-6 shadow-premium cursor-pointer group hover:bg-white/5 transition-all text-left`}>
               <div className="flex justify-between items-center text-left">
                  <span className="px-4 py-1 bg-slate-800 text-slate-400 rounded-full text-[8px] font-black uppercase italic tracking-widest">{h.fecha} | {h.tipo}</span>
                  <p className={`text-[10px] font-black uppercase italic ${h.estado === 'RECHAZADO' ? 'text-rose-500' : 'text-emerald-500'}`}>{h.estado}</p>
               </div>
               <h3 className="text-4xl font-black italic uppercase text-slate-100 tracking-tighter text-left">"{h.titulo}"</h3>
               <p className="text-[10px] font-black uppercase text-slate-500 italic text-left">Autor: {h.autor}</p>
            </div>
          ))}
       </div>
    </div>
  );
}

function PrensaView({ state, isPres }: any) {
  const [f, setF] = useState({ titulo: '', articulado: '' });
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="space-y-12 animate-in text-left">
       <div className="flex justify-between items-center">
          <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Prensa Oficial</h2>
          {isPres && <button onClick={() => setShowAdd(!showAdd)} className="p-6 bg-blue-600 rounded-3xl shadow-xl hover:scale-110 transition-all border-b-8 border-blue-950"><Plus size={32}/></button>}
       </div>
       {showAdd && (
         <div className="bg-[#0a1120]/80 p-12 rounded-[4rem] border-2 border-blue-600/30 space-y-8 shadow-premium backdrop-blur-xl">
            <input value={f.titulo} onChange={e=>setF({...f, titulo: e.target.value})} placeholder="Titular..." className="w-full bg-black/40 p-8 rounded-3xl border border-white/10 text-white font-bold text-2xl outline-none" />
            <textarea value={f.articulado} onChange={e=>setF({...f, articulado: e.target.value})} placeholder="Cuerpo..." className="w-full bg-black/40 p-10 rounded-[3.5rem] border border-white/10 text-slate-300 font-serif text-2xl h-60 outline-none" />
            <button onClick={()=>{db.get('news').get(`news-${Date.now()}`).put(JSON.stringify({...f, id:`news-${Date.now()}`, fecha:new Date().toLocaleDateString(), hora:new Date().toLocaleTimeString(), autor:Role.PRESIDENTE})); setF({titulo:'', articulado:''}); setShowAdd(false);}} className="w-full py-8 bg-blue-700 text-white rounded-[3.5rem] font-black uppercase text-2xl italic border-b-[15px] border-blue-950 active:translate-y-2">Publicar Comunicado</button>
         </div>
       )}
       <div className="grid grid-cols-1 gap-10">
          {state.news.map((n: any) => (
            <div key={n.id} className="bg-[#0a1120]/60 p-12 rounded-[5rem] border border-white/5 space-y-8 shadow-premium backdrop-blur-sm relative group hover:border-blue-600/20 transition-all text-left">
               <div className="flex justify-between items-center text-left">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">{n.fecha} {n.hora} | Publicado por: {n.autor}</span>
                  {isPres && <button onClick={()=>db.get('news').get(n.id).put(null)} className="text-rose-700 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20}/></button>}
               </div>
               <h3 className="text-5xl font-black italic uppercase text-slate-100 tracking-tighter leading-none text-left">"{n.titulo}"</h3>
               <p className="text-3xl font-serif italic text-slate-300 leading-relaxed whitespace-pre-wrap border-t border-white/10 pt-8 text-left">{n.articulado}</p>
            </div>
          ))}
       </div>
    </div>
  );
}

function ActasDigitalesView({ state, isPres, user }: any) {
  const [f, setF] = useState({ titulo: '', contenido: '' });
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="space-y-12 animate-in text-left">
       <div className="flex justify-between items-center">
          <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Actas Digitales</h2>
          {isPres && <button onClick={() => setShowAdd(!showAdd)} className="p-6 bg-emerald-600 rounded-3xl shadow-xl hover:scale-110 transition-all border-b-8 border-emerald-950"><Plus size={32}/></button>}
       </div>
       {showAdd && (
         <div className="bg-[#0a1120]/80 p-12 rounded-[4rem] border-2 border-emerald-600/30 space-y-8 shadow-premium backdrop-blur-xl">
            <input value={f.titulo} onChange={e=>setF({...f, titulo: e.target.value})} placeholder="Encabezado del Acta..." className="w-full bg-black/40 p-8 rounded-3xl border border-white/10 text-white font-bold text-2xl outline-none" />
            <textarea value={f.contenido} onChange={e=>setF({...f, contenido: e.target.value})} placeholder="Redacción..." className="w-full bg-black/40 p-10 rounded-[3rem] border border-white/10 text-slate-300 font-serif text-2xl h-80 outline-none" />
            <button onClick={()=>{db.get('actas').get(`acta-${Date.now()}`).put(JSON.stringify({...f, id:`acta-${Date.now()}`, fecha:new Date().toLocaleDateString(), hora:new Date().toLocaleTimeString(), autor:user.nombre+' '+user.apellido})); setF({titulo:'', contenido:''}); setShowAdd(false);}} className="w-full py-8 bg-emerald-600 text-white rounded-[3.5rem] font-black uppercase text-2xl italic border-b-[15px] border-emerald-950 active:translate-y-2">Sellar Acta</button>
         </div>
       )}
       <div className="grid grid-cols-1 gap-10">
          {state.actas.map((a: any) => (
            <div key={a.id} className="bg-[#0a1120]/60 p-12 rounded-[5rem] border border-white/5 space-y-8 shadow-premium backdrop-blur-sm group hover:border-emerald-600/30 transition-all text-left">
               <div className="flex justify-between items-center border-b border-white/5 pb-8 text-left">
                  <div className="text-left"><h3 className="text-5xl font-black italic uppercase text-slate-100 tracking-tighter leading-none text-left">"{a.titulo}"</h3><p className="text-xs font-bold uppercase text-slate-500 mt-4 italic tracking-widest text-left">{a.fecha} | Firmado: {a.autor}</p></div>
                  <FileSignature size={60} className="text-emerald-500 opacity-20" />
               </div>
               <p className="text-3xl font-serif italic text-slate-300 leading-relaxed whitespace-pre-wrap text-left">{a.contenido}</p>
            </div>
          ))}
       </div>
    </div>
  );
}

function BajasView({ state, isPres }: any) {
  const disabled = state.users.filter((u: any) => !u.habilitado);
  return (
    <div className="space-y-12 animate-in text-center">
       <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Exclusiones Vigentes</h2>
       <div className="grid grid-cols-1 gap-8 max-w-4xl mx-auto text-left">
          {disabled.map((u: any) => (
            <div key={u.id} className="bg-[#0a1120]/60 p-12 rounded-[5rem] border-2 border-rose-700/30 flex justify-between items-center shadow-premium backdrop-blur-sm group hover:border-rose-600 transition-all">
               <div><h3 className="text-4xl font-black italic text-rose-500 uppercase tracking-tighter">{u.apellido}, {u.nombre}</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">EXCLUIDO POR TRIBUNAL DE HONOR</p></div>
               {isPres && <button onClick={()=>db.get('users').get(u.id).put({habilitado:true})} className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] italic border-b-4 border-emerald-950 shadow-gold-soft active:translate-y-1">Rehabilitar</button>}
            </div>
          ))}
          {disabled.length === 0 && <p className="py-40 opacity-20 italic text-5xl font-black uppercase tracking-tighter text-center w-full">Sin Exclusiones Vigentes</p>}
       </div>
    </div>
  );
}

function HimnosView({ master, isPres }: any) {
  return (
    <div className="space-y-12 animate-in text-center">
       <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Himnos Patrios</h2>
       <div className="grid grid-cols-3 gap-10 max-w-6xl mx-auto">
          {Object.entries(HIMNOS).map(([key, h]: any) => (
            <div key={key} className="bg-[#0a1120]/60 p-12 rounded-[4rem] border border-white/5 space-y-8 shadow-premium flex flex-col items-center group transition-all hover:border-amber-600/30">
               <Music size={100} className="text-amber-500 opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all" />
               <div><h3 className="text-3xl font-black uppercase italic gold-gradient-text tracking-tighter">{h.titulo}</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">{h.description}</p></div>
               {isPres && (
                 <div className="flex flex-col gap-4 w-full pt-4">
                    <button onClick={()=>db.get('global').get('projection').put(`HIMNO_${key==='NACIONAL'?'NAC':key==='MISIONES'?'MIS':'PE'}`)} className="w-full py-4 bg-sky-600 text-white rounded-2xl font-black uppercase text-[10px] italic border-b-4 border-sky-900 shadow-premium active:translate-y-1">Proyectar Himno</button>
                    <button className="w-full py-4 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] italic flex items-center justify-center gap-2">Reproducir en Dispositivo</button>
                 </div>
               )}
            </div>
          ))}
       </div>
    </div>
  );
}

function ComisionesView({ state, isPres, setEditingComision, user }: any) {
  return (
    <div className="space-y-12 animate-in text-left">
       <div className="flex justify-between items-center">
          <h2 className="text-7xl font-black italic gold-gradient-text uppercase tracking-tighter leading-none">Autoridades y Comisiones</h2>
          {isPres && <button onClick={() => setEditingComision(`com-${Date.now()}`)} className="p-6 bg-amber-600 rounded-3xl shadow-xl hover:scale-110 transition-all border-b-8 border-amber-950"><Plus size={32}/></button>}
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {state.comisiones.map((c: any) => (
             <div key={c.id} className="bg-[#0a1120]/60 p-12 rounded-[5rem] border border-white/5 space-y-8 shadow-premium relative group backdrop-blur-sm group transition-all hover:border-amber-600/20 text-left">
                <div className="flex justify-between items-start text-left">
                   <h3 className="text-5xl font-black italic uppercase gold-gradient-text tracking-tighter leading-none text-left">{c.nombre}</h3>
                   {isPres && <button onClick={() => setEditingComision(c.id)} className="text-sky-500 hover:text-sky-300 transition-colors"><Edit3 size={24}/></button>}
                </div>
                <div className="space-y-6 pt-8 border-t border-white/5 text-left">
                   <AuthorityLine label="PRESIDENTE COM." value={state.users.find((u:any)=>u.id===c.presidenteId)?.apellido} />
                   <AuthorityLine label="VICEPRESIDENTE 1º" value={state.users.find((u:any)=>u.id===c.vice1Id)?.apellido} />
                   <div className="pt-4 text-left">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2 text-left">MIEMBROS DE SALA:</p>
                      <div className="flex flex-wrap gap-2 text-left">
                         {c.integrantesIds?.map((iid: string) => <span key={iid} className="px-4 py-1 bg-black/40 rounded-full text-[10px] font-black uppercase italic text-slate-300 border border-white/5">{state.users.find((u:any)=>u.id===iid)?.apellido}</span>)}
                      </div>
                   </div>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}

function AuthorityLine({ label, value }: any) {
  return (
    <div className="flex justify-between items-center text-left">
       <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest text-left">{label}:</span>
       <span className="text-3xl font-black italic text-slate-100 uppercase tracking-tighter leading-none text-right">{value || 'VACANTE'}</span>
    </div>
  );
}
