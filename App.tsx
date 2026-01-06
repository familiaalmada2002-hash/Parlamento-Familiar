
import React, { useState, useEffect, useMemo } from 'react';
import { Role, User, Proyecto, AppState, Sancion, Comision, ProjectionMode, Sentencia } from './types';
import { 
  Landmark, Mic2, X, Trash2, Gavel, FileText, Settings, 
  ListChecks, Newspaper, Check, Maximize, Stamp, 
  Layout, Scale, UserCheck, ShieldAlert, ChevronRight, Music, 
  Search, Plus, Flame, Building2, UserCircle, CheckCircle2, Shield, AlertCircle, Briefcase, Archive, Scale as ScaleIcon,
  Vote, BookOpen, UserPlus, Info, Save, History, RotateCcw, StopCircle, LogOut, Users, Award, Ban, FileSignature,
  AlertTriangle, Fingerprint, Eye, Calendar, User as UserIcon
} from 'lucide-react';
import { INITIAL_USERS, SYMBOLS, ESTATUTO_COMPLETO, HIMNOS } from './constants';
import Gun from 'gun';

const gun = Gun({ peers: ['https://gun-manhattan.herokuapp.com/gun'] });
const db = gun.get('PARLAMENTO_FAMILIAR_FINAL_DEPLOY_V4_PRO');

export default function App() {
  const [isLogged, setIsLogged] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('inicio');
  const [dniInput, setDniInput] = useState('');
  const [fullScreenProj, setFullScreenProj] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Proyecto | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<Proyecto | null>(null);
  const [estatutoSearch, setEstatutoSearch] = useState('');
  const [editingComision, setEditingComision] = useState<string | null>(null);
  const [customVoteTopic, setCustomVoteTopic] = useState('');

  const [state, setState] = useState<AppState>({
    users: [], projects: [], news: [], ordenDia: [],
    archivosHistoricos: [], archivosGeneral: [], comisiones: [],
    sessionStatus: 'CERRADA', sessionType: 'ORDINARIA', sessionNumber: '001',
    candleLit: false, investitureDone: false,
    speakerId: null, speakerTimer: 300, activeVoteTopic: null, activeVoteRefId: null,
    manualVotes: { yes: 0, no: 0, abs: 0 }, projectionMode: 'LOGO',
    currentTime: new Date()
  });

  const isPres = useMemo(() => currentUser?.cargo === Role.PRESIDENTE || currentUser?.dni === '49993070', [currentUser]);

  // Sincronización RealTime con Gun.js
  useEffect(() => {
    db.get('global').on((data) => {
      if (!data) return;
      setState(prev => ({ ...prev, 
        sessionStatus: data.status || 'CERRADA',
        sessionType: data.sessionType || 'ORDINARIA',
        candleLit: !!data.candleLit,
        investitureDone: !!data.investitureDone,
        speakerId: data.speakerId || null,
        speakerTimer: data.speakerTimer ?? 300,
        activeVoteTopic: data.voteTopic || null,
        activeVoteRefId: data.voteRefId || null,
        manualVotes: data.manualVotes ? JSON.parse(data.manualVotes) : { yes: 0, no: 0, abs: 0 },
        projectionMode: (data.projection as ProjectionMode) || 'LOGO',
        lastSanctionedUserId: data.lastSanctionedUserId || undefined
      }));
    });

    const collections = ['users', 'projects', 'news', 'ordenDia', 'archivosHistoricos', 'archivosGeneral', 'comisiones'];
    collections.forEach(key => {
      db.get(key).map().on((val, id) => {
        if (val === null) {
          setState(prev => ({ ...prev, [key]: (prev[key as keyof AppState] as any[]).filter((x:any) => x.id !== id) }));
        } else {
          setState(prev => {
            const arr = (prev[key as keyof AppState] as any[]);
            const others = arr.filter((x:any) => x.id !== id);
            const item = typeof val === 'string' ? JSON.parse(val) : val;
            return { ...prev, [key]: [...others, { ...item, id }].sort((a,b) => (a.numero || a.banca || a.nombre || 0).toString().localeCompare((b.numero || b.banca || b.nombre || 0).toString())) };
          });
        }
      });
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setState(prev => ({ ...prev, currentTime: new Date() }));
      if (isPres && state.speakerId && state.speakerTimer > 0 && state.sessionStatus === 'ABIERTA') {
        db.get('global').put({ speakerTimer: state.speakerTimer - 1 });
      } else if (isPres && state.speakerId && state.speakerTimer <= 0) {
        master.revokeWord(state.speakerId);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [state.speakerId, state.speakerTimer, state.sessionStatus, isPres]);

  const master = {
    login: () => {
      const user = state.users.find(u => u.dni === dniInput) || INITIAL_USERS.find(u => u.dni === dniInput);
      if (user) {
        if (!user.habilitado) { alert('SANCIONADO: BANCA BLOQUEADA POR EL TRIBUNAL'); return; }
        setCurrentUser(user);
        setIsLogged(true);
        db.get('users').get(user.id).put({ presente: true });
      } else { alert('DNI NO REGISTRADO O ACCESO DENEGADO'); }
    },
    logout: () => {
      if (currentUser) db.get('users').get(currentUser.id).put({ presente: false });
      setIsLogged(false);
      setCurrentUser(null);
    },
    toggleCandle: () => {
      const v = !state.candleLit;
      db.get('global').put({ candleLit: v });
      if (v) master.setProjection('VELA');
    },
    toggleInvestiture: () => {
      const v = !state.investitureDone;
      db.get('global').put({ investitureDone: v });
      if (v) master.setProjection('INVESTIDURA');
    },
    setProjection: (mode: ProjectionMode) => isPres && db.get('global').put({ projection: mode }),
    manageLegislative: (id: string, action: Proyecto['estado'], votes?: { yes: number, no: number, abs: number }) => {
      if (!isPres) return;
      const all = [...state.projects, ...state.ordenDia];
      const p = all.find(x => x.id === id);
      if (!p) return;

      if (['APROBADO', 'RECHAZADO', 'SANCIONADO_IMPLEMENTADO'].includes(action)) {
        const hId = `h-${Date.now()}`;
        db.get('archivosHistoricos').get(hId).put(JSON.stringify({ 
            ...p, 
            id: hId, 
            resultado: action as any, 
            fecha: new Date().toLocaleString(),
            votosSi: votes?.yes || 0,
            votosNo: votes?.no || 0,
            votosAbs: votes?.abs || 0
        }));
        db.get('projects').get(id).put(null);
        db.get('ordenDia').get(id).put(null);
      } else if (action === 'ARCHIVADO') {
        db.get('archivosGeneral').get(id).put(JSON.stringify({ ...p, estado: 'ARCHIVADO' }));
        db.get('projects').get(id).put(null);
        db.get('ordenDia').get(id).put(null);
      } else if (action === 'ORDEN_DIA') {
        db.get('ordenDia').get(id).put(JSON.stringify({ ...p, estado: 'ORDEN_DIA' }));
        db.get('projects').get(id).put(null);
      }
      setSelectedProject(null);
    },
    createVote: (topic: string, refId: string | null) => {
      if (!isPres) return;
      db.get('global').put({ voteTopic: topic, voteRefId: refId, projection: 'VOTACION_CURSO' });
      state.users.forEach(u => db.get('users').get(u.id).put({ votoActual: null }));
    },
    finishVote: () => {
      if (!isPres) return;
      const votes = state.users.filter(u => u.presente);
      const yes = votes.reduce((acc, u) => acc + (u.votoActual === 'YES' ? (u.votoDobleEjercido ? 2 : 1) : 0), 0);
      const no = votes.reduce((acc, u) => acc + (u.votoActual === 'NO' ? 1 : 0), 0);
      const abs = votes.filter(u => u.votoActual === 'ABSTAIN').length;
      const res = yes > no ? 'APROBADO' : 'RECHAZADO';

      if (state.activeVoteRefId) {
        master.manageLegislative(state.activeVoteRefId, res, { yes, no, abs });
      } else {
        const hId = `h-${Date.now()}`;
        db.get('archivosHistoricos').get(hId).put(JSON.stringify({ 
            id: hId,
            titulo: state.activeVoteTopic, 
            resultado: res as any, 
            votosSi: yes, 
            votosNo: no, 
            votosAbs: abs, 
            fecha: new Date().toLocaleString(),
            autor: currentUser?.apellido || 'PRESIDENCIA'
        }));
      }
      db.get('global').put({ voteTopic: null, voteRefId: null, manualVotes: JSON.stringify({ yes, no, abs }), projection: 'VOTACION_RESULTADO' });
    },
    applySanction: (uid: string, motivo: string, consecuencia: string) => {
      if (!isPres) return;
      const user = state.users.find(u => u.id === uid);
      if (!user) return;
      const s: Sancion = { id: Date.now().toString(), tipo: 'DISCIPLINARIA', motivo, consecuencia, fecha: new Date().toLocaleString(), autoridad: currentUser?.apellido || 'PRESIDENCIA' };
      const current = user.sanciones ? (typeof user.sanciones === 'string' ? JSON.parse(user.sanciones) : user.sanciones) : [];
      const updated = [...current, s];
      db.get('users').get(uid).put({ sanciones: JSON.stringify(updated) });
      db.get('global').put({ lastSanctionedUserId: uid, projection: updated.length >= 3 ? 'JUICIO' : 'SANCION' });
    },
    dictarSentencia: (uid: string, veredicto: Sentencia['veredicto'], detalle: string) => {
      const user = state.users.find(u => u.id === uid);
      if (!user) return;
      const sent: Sentencia = { id: Date.now().toString(), fecha: new Date().toLocaleString(), veredicto, detalle, juez: currentUser?.apellido || 'TRIBUNAL' };
      const current = user.sentencias ? (typeof user.sentencias === 'string' ? JSON.parse(user.sentencias) : user.sentencias) : [];
      db.get('users').get(uid).put({ 
        sentencias: JSON.stringify([...current, sent]), 
        habilitado: veredicto !== 'EXPULSION_PERMANENTE',
        sanciones: JSON.stringify([]) 
      });
      master.setProjection('LOGO');
      alert('SENTENCIA DICTADA Y ARCHIVADA.');
    },
    requestWord: () => {
      if (currentUser) {
        db.get('users').get(currentUser.id).put({ pedirPalabra: 'ESPERA' });
      }
    },
    grantWord: (uid: string) => {
      if (!isPres) return;
      db.get('global').put({ speakerId: uid, speakerTimer: 300, projection: 'DEBATE' });
      db.get('users').get(uid).put({ pedirPalabra: 'CONCEDIDA' });
    },
    revokeWord: (uid: string) => {
      if (!isPres) return;
      db.get('global').put({ speakerId: null, speakerTimer: 300, projection: 'LOGO' });
      db.get('users').get(uid).put({ pedirPalabra: 'NINGUNO' });
    }
  };

  const estatutoFiltrado = useMemo(() => {
    if (!estatutoSearch) return ESTATUTO_COMPLETO;
    return ESTATUTO_COMPLETO.split('\n').filter(l => l.toLowerCase().includes(estatutoSearch.toLowerCase())).join('\n\n');
  }, [estatutoSearch]);

  if (!isLogged) return <LoginView dni={dniInput} setDni={setDniInput} onLogin={master.login} />;

  return (
    <div className="flex h-screen bg-[#050a14] text-slate-100 overflow-hidden font-['Inter']">
      {/* Sidebar Suprema */}
      <aside className="w-80 bg-[#0a1120] border-r border-amber-900/20 flex flex-col shadow-2xl z-50 overflow-y-auto custom-scrollbar">
        <div className="p-8 border-b border-amber-900/10 bg-black/40 flex flex-col items-center">
          <img src={SYMBOLS.ARG_SHIELD} className="h-20 w-auto mb-4 drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
          <h1 className="text-2xl font-black uppercase gold-gradient-text tracking-widest text-center leading-none italic">SALA SUPREMA</h1>
          <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-[0.3em]">Puerto Esperanza</p>
        </div>
        
        <div className="p-4 space-y-8 flex-1">
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
             <MenuBtn id="antecedentes" label="Antecedentes" icon={<FileSignature/>} active={activeTab} onClick={setActiveTab} />
             <MenuBtn id="bajas" label="Exclusiones" icon={<Ban/>} active={activeTab} onClick={setActiveTab} />
          </NavSection>

          {isPres && (
            <NavSection title="Administración">
               <MenuBtn id="etica" label="Tribunal" icon={<Gavel/>} active={activeTab} onClick={setActiveTab} />
               <MenuBtn id="admin" label="Configuración" icon={<Settings/>} active={activeTab} onClick={setActiveTab} />
            </NavSection>
          )}
        </div>

        <button onClick={master.logout} className="p-6 bg-rose-950/20 text-rose-500 font-black uppercase text-xs hover:bg-rose-900 hover:text-white transition-all flex items-center justify-center gap-3"><LogOut size={16}/> Cerrar Sesión</button>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header Premium */}
        <header className="h-24 bg-[#0a1120]/90 backdrop-blur-2xl border-b border-amber-900/20 px-10 flex items-center justify-between z-40 shadow-xl">
           <div className="flex items-center gap-10">
              <SessionBadge status={state.sessionStatus} type={state.sessionType} />
              <div className="flex items-center gap-4 bg-amber-500/5 px-6 py-2.5 rounded-full border border-amber-500/20 shadow-gold-soft">
                 <span className="text-amber-500 font-black text-sm uppercase">QUÓRUM REAL: {state.users.filter(u=>u.presente).length} / {state.users.length}</span>
                 {state.candleLit && <Flame size={18} className="text-amber-400 animate-pulse drop-shadow-[0_0_10px_#fbbf24]" />}
                 {state.investitureDone && <Stamp size={18} className="text-purple-500 drop-shadow-[0_0_10px_#a855f7]" />}
              </div>
           </div>
           <div className="flex items-center gap-10">
              <div className="text-right">
                 <p className="text-3xl font-mono font-black gold-gradient-text leading-none">{state.currentTime.toLocaleTimeString()}</p>
                 <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 italic tracking-widest">{currentUser?.apellido} - BANCA {currentUser?.banca}</p>
              </div>
              <button onClick={() => setFullScreenProj(true)} className="p-4 bg-sky-600 text-white rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all"><Maximize size={24}/></button>
           </div>
        </header>

        {/* Vistas Dinámicas */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-12 bg-dark-magno">
           <div className="max-w-7xl mx-auto space-y-12 pb-40 animate-in">
              {activeTab === 'inicio' && <DashboardView state={state} user={currentUser!} isPres={isPres} setActiveTab={setActiveTab} master={master} />}
              {activeTab === 'recinto' && <RecintoView state={state} isPres={isPres} master={master} currentUser={currentUser!} />}
              {activeTab === 'votacion' && <VotacionView state={state} user={currentUser!} isPres={isPres} master={master} customVoteTopic={customVoteTopic} setCustomVoteTopic={setCustomVoteTopic} />}
              {activeTab === 'debate' && <OratoriaView state={state} isPres={isPres} master={master} user={currentUser!} />}
              {activeTab === 'estatuto' && (
                <div className="space-y-12">
                   <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Estatuto Supremo</h2>
                   <div className="relative">
                      <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-500" size={24} />
                      <input value={estatutoSearch} onChange={e=>setEstatutoSearch(e.target.value)} placeholder="Consultar los 529 artículos por palabra clave..." className="w-full bg-[#0a1120]/60 p-8 pl-20 rounded-[2.5rem] border border-white/10 font-bold text-xl text-white outline-none focus:border-amber-600 transition-all shadow-inner" />
                   </div>
                   <div className="bg-[#0a1120]/80 p-16 rounded-[4rem] font-serif italic text-slate-300 text-3xl leading-relaxed whitespace-pre-wrap max-h-[65vh] overflow-y-auto custom-scrollbar border-y-8 border-amber-600 shadow-premium">
                      {estatutoFiltrado}
                      {!estatutoFiltrado && <p className="text-center py-20 opacity-30 italic">No se hallaron concordancias con "{estatutoSearch}"</p>}
                   </div>
                </div>
              )}
              {activeTab === 'proyectos' && <LegislativeView title="Proyectos de Ley" type="LEY" state={state} user={currentUser!} master={master} onSelect={setSelectedProject} />}
              {activeTab === 'mociones' && <LegislativeView title="Mociones de Recinto" type="MOCION" state={state} user={currentUser!} master={master} onSelect={setSelectedProject} />}
              {activeTab === 'orden' && <OrdenDiaView state={state} isPres={isPres} master={master} onSelect={setSelectedProject} />}
              {activeTab === 'comisiones' && <ComisionesView state={state} isPres={isPres} master={master} setEditingComision={setEditingComision} user={currentUser!} />}
              {activeTab === 'etica' && <EticaView state={state} isPres={isPres} master={master} user={currentUser!} />}
              {activeTab === 'antecedentes' && <AntecedentesView state={state} user={currentUser!} isPres={isPres} />}
              {activeTab === 'historico' && <HistoryView state={state} onSelect={setSelectedHistory} />}
              {activeTab === 'lista' && <UserListView state={state} isPres={isPres} />}
              {activeTab === 'tv' && <TVSessionView state={state} setFullScreenProj={setFullScreenProj} isPres={isPres} master={master} />}
              {activeTab === 'admin' && isPres && <AdminView state={state} master={master} />}
              {activeTab === 'himnos' && <HimnosView master={master} isPres={isPres} />}
              {activeTab === 'prensa' && <PrensaView state={state} isPres={isPres} user={currentUser!} />}
              {activeTab === 'bajas' && <BajasView state={state} isPres={isPres} />}
           </div>
        </div>
      </main>

      {/* Modales Progresivos */}
      {selectedProject && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-10 animate-in">
           <div className="bg-[#0a1120] border-2 border-amber-600/30 w-full max-w-5xl p-16 rounded-[5rem] shadow-premium relative overflow-hidden">
              <button onClick={() => setSelectedProject(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all"><X size={48}/></button>
              <div className="space-y-10">
                <div className="border-b border-white/5 pb-10">
                   <p className="text-amber-500 font-black uppercase text-sm tracking-[0.5em] mb-4 italic">Expediente Oficial</p>
                   <h2 className="text-6xl font-black italic uppercase gold-gradient-text tracking-tighter">"{selectedProject.titulo}"</h2>
                </div>
                <div className="bg-black/60 p-12 rounded-[3.5rem] text-3xl font-serif italic text-slate-300 leading-relaxed max-h-[40vh] overflow-y-auto custom-scrollbar border-l-8 border-amber-600 shadow-inner">
                   {selectedProject.articulado}
                </div>
                {isPres && (
                  <div className="grid grid-cols-5 gap-6 pt-10">
                     <ActionBtn label="Aprobar" color="bg-emerald-600" onClick={() => master.manageLegislative(selectedProject.id, 'APROBADO')} icon={<Check size={20}/>}/>
                     <ActionBtn label="Rechazar" color="bg-rose-700" onClick={() => master.manageLegislative(selectedProject.id, 'RECHAZADO')} icon={<Trash2 size={20}/>}/>
                     <ActionBtn label="Archivar" color="bg-slate-700" onClick={() => master.manageLegislative(selectedProject.id, 'ARCHIVADO')} icon={<Archive size={20}/>}/>
                     <ActionBtn label="A Orden" color="bg-sky-600" onClick={() => master.manageLegislative(selectedProject.id, 'ORDEN_DIA')} icon={<ListChecks size={20}/>}/>
                     <ActionBtn label="Votar" color="bg-purple-600" onClick={() => master.createVote(selectedProject.titulo, selectedProject.id)} icon={<Vote size={20}/>}/>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {selectedHistory && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-10 animate-in">
            <div className="bg-[#0a1120] border-2 border-amber-600/30 w-full max-w-4xl p-16 rounded-[4rem] shadow-premium relative">
                <button onClick={() => setSelectedHistory(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={40}/></button>
                <div className="space-y-10">
                    <div className="flex justify-between items-start border-b border-white/5 pb-8">
                        <div>
                            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedHistory.resultado === 'APROBADO' ? 'bg-emerald-600' : 'bg-rose-700'}`}>{selectedHistory.resultado}</span>
                            <h2 className="text-5xl font-black italic gold-gradient-text mt-4">"{selectedHistory.titulo}"</h2>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Fecha de Registro</p>
                            <p className="text-xl font-bold text-white">{selectedHistory.fecha}</p>
                        </div>
                    </div>
                    <div className="bg-black/40 p-10 rounded-[2.5rem] text-xl text-slate-300 font-serif italic max-h-[30vh] overflow-y-auto">
                        {selectedHistory.articulado || "Acta de votación directa sin articulado adjunto."}
                    </div>
                    <div className="grid grid-cols-3 gap-8">
                        <HistoryDetailCard label="Votos Afirmativos" val={selectedHistory.votosSi || 0} color="text-emerald-500" />
                        <HistoryDetailCard label="Votos Negativos" val={selectedHistory.votosNo || 0} color="text-rose-600" />
                        <HistoryDetailCard label="Abstenciones" val={selectedHistory.votosAbs || 0} color="text-amber-500" />
                    </div>
                    <div className="pt-6 text-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Iniciador del Expediente: {selectedHistory.autor || 'PRESIDENCIA'}</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {editingComision && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-10">
           <ComisionEditModal 
             comision={state.comisiones.find(c => c.id === editingComision) || { id: editingComision, nombre: 'Comisión', presidenteId: null, vice1Id: null, vice2Id: null, integrantesIds: [] }} 
             users={state.users} 
             onClose={() => setEditingComision(null)} 
             onSave={(data:any) => { db.get('comisiones').get(editingComision!).put(JSON.stringify({...data, id: editingComision})); setEditingComision(null); }} 
           />
        </div>
      )}

      {fullScreenProj && (
        <div className="fixed inset-0 z-[1000] bg-black">
           <ProjectionScreen state={state} time={state.currentTime} />
           <button onClick={() => setFullScreenProj(false)} className="absolute top-10 right-10 p-6 bg-rose-700/50 hover:bg-rose-700 text-white rounded-full transition-all shadow-xl"><X size={48}/></button>
        </div>
      )}
    </div>
  );
}

// --- Vistas de Clase Mundial ---

function DashboardView({ state, user, isPres, setActiveTab, master }: any) {
  const sections = [
    { id: 'recinto', label: 'Mapa Recinto', icon: <Layout/>, color: 'bg-amber-600' },
    { id: 'votacion', label: 'Escrutinio Real', icon: <Vote/>, color: 'bg-emerald-600' },
    { id: 'debate', label: 'Oratoria', icon: <Mic2/>, color: 'bg-sky-600' },
    { id: 'orden', label: 'Orden del Día', icon: <ListChecks/>, color: 'bg-blue-600' },
    { id: 'proyectos', label: 'Proyectos de Ley', icon: <Scale/>, color: 'bg-purple-600' },
    { id: 'mociones', label: 'Mociones', icon: <Award/>, color: 'bg-rose-600' },
    { id: 'estatuto', label: 'Estatuto', icon: <BookOpen/>, color: 'bg-slate-700' },
    { id: 'prensa', label: 'Prensa Oficial', icon: <Newspaper/>, color: 'bg-indigo-600' }
  ];

  return (
    <div className="space-y-12">
       <div className="bg-[#0a1120] p-16 rounded-[6rem] border-l-[20px] border-amber-600 shadow-premium relative overflow-hidden group">
          <div className="z-10 relative space-y-8">
             <p className="text-amber-500 font-black text-sm tracking-[0.5em] uppercase italic">Portal de Gestión Suprema</p>
             <h2 className="text-[7.5rem] font-black italic uppercase gold-gradient-text leading-none tracking-tighter">Bienvenido,<br/> {user.nombre} {user.apellido}</h2>
             <div className="flex gap-8 items-center">
                <button onClick={master.requestWord} className="px-16 py-6 bg-amber-600 text-white rounded-[2.5rem] font-black uppercase text-sm shadow-gold-soft hover:scale-105 transition-all italic border-b-8 border-amber-950 flex items-center gap-4"><Mic2/> Pedir la Palabra</button>
                <div className="text-2xl font-serif italic text-slate-400">Su banca es la Nº {user.banca}</div>
             </div>
          </div>
          <Landmark size={550} className="absolute -right-40 -bottom-40 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-all duration-1000" />
       </div>

       <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveTab(s.id)} className={`${s.color} p-10 rounded-[3.5rem] flex flex-col items-center justify-center text-center space-y-6 shadow-premium hover:scale-105 transition-all border-b-8 border-black/20`}>
               <div className="p-5 bg-white/20 rounded-3xl">{React.cloneElement(s.icon as any, { size: 40 })}</div>
               <span className="font-black uppercase italic text-xs tracking-widest">{s.label}</span>
            </button>
          ))}
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <StatCard label="Legisladores Registrados" val={state.users.length} icon={<Users size={32}/>} color="text-amber-500" />
          <StatCard label="Proyectos en Mesa" val={state.projects.length} icon={<ScaleIcon size={32}/>} color="text-sky-500" />
          <StatCard label="Historial de Sesiones" val={state.archivosHistoricos.length} icon={<History size={32}/>} color="text-emerald-500" />
          <StatCard label="Alertas de Ética" val={state.users.reduce((acc:any, u:any) => acc + (u.sanciones ? (typeof u.sanciones === 'string' ? JSON.parse(u.sanciones) : u.sanciones).length : 0), 0)} icon={<ShieldAlert size={32}/>} color="text-rose-600" />
       </div>
    </div>
  );
}

function StatCard({ label, val, icon, color }: any) {
  return (
    <div className="bg-[#0a1120] p-12 rounded-[4rem] border border-white/5 flex flex-col items-center justify-center text-center space-y-6 shadow-2xl hover:scale-105 transition-all">
       <div className={`p-6 bg-white/5 rounded-[2rem] ${color} shadow-inner`}>{icon}</div>
       <p className={`text-8xl font-black italic ${color} tabular-nums leading-none`}>{val}</p>
       <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic">{label}</p>
    </div>
  );
}

function RecintoView({ state, isPres, master, currentUser }: any) {
  return (
    <div className="space-y-12 animate-in text-center pb-40">
       <h2 className="text-7xl font-black italic uppercase gold-gradient-text tracking-tighter leading-none">Mapa del Recinto Soberano</h2>
       <div className="bg-[#0a1120] p-24 rounded-[6rem] border border-amber-900/10 relative flex flex-col items-center shadow-premium">
          <div className="w-full flex justify-center mb-44 gap-36 scale-150 z-10">
             <Seat banca={2} user={state.users.find((u:any)=>u.banca===2)} label="VICE 1º" big />
             <Seat banca={1} user={state.users.find((u:any)=>u.banca===1)} label="PRESIDENCIA" big />
             <Seat banca={3} user={state.users.find((u:any)=>u.banca===3)} label="VICE 2º" big />
          </div>
          <div className="grid grid-cols-10 gap-14 w-full px-10 border-t-8 border-white/5 pt-28 relative z-10">
             {Array.from({length: 38}).map((_, i) => {
               const bNum = i + 1;
               if (bNum <= 3) return null;
               const u = state.users.find((x:any) => x.banca === bNum);
               return <Seat key={bNum} banca={bNum} user={u} />;
             })}
          </div>
          <div className="pt-24 w-full flex flex-col items-center gap-8 border-t border-white/5 mt-16">
              <button 
                onClick={master.requestWord} 
                className="px-24 py-10 bg-amber-600 text-white rounded-[4rem] font-black uppercase 3xl shadow-gold-soft border-b-[15px] border-amber-950 active:translate-y-2 active:border-b-0 transition-all italic flex items-center gap-6"
              >
                <Mic2 size={48}/> Pedir la Palabra
              </button>
              <p className="text-slate-500 uppercase font-black tracking-widest italic text-sm">Estado actual: {currentUser?.pedirPalabra}</p>
          </div>
       </div>
    </div>
  );
}

function Seat({ banca, user, label, big }: any) {
  const status = user ? (user.pedirPalabra === 'CONCEDIDA' ? 'speaking' : (user.presente ? 'online' : 'offline')) : 'empty';
  return (
    <div className={`flex flex-col items-center ${big ? 'scale-110' : ''} group relative`}>
       {label && <span className="mb-4 text-[11px] font-black text-amber-500 uppercase tracking-[0.3em] italic">{label}</span>}
       <div className={`${big ? 'w-48 h-48' : 'w-24 h-24'} rounded-[3rem] border-4 flex items-center justify-center transition-all duration-700 ${
         status === 'speaking' ? 'bg-sky-600 border-sky-400 shadow-gold-soft animate-pulse scale-110' :
         status === 'online' ? 'bg-emerald-600 border-emerald-400 shadow-xl' :
         status === 'offline' ? 'bg-rose-950 border-rose-900 opacity-40 grayscale' : 'bg-white/5 border-white/10 opacity-10'
       }`}>
          <span className={`${big ? 'text-7xl' : 'text-4xl'} font-black text-white italic tabular-nums`}>{banca}</span>
       </div>
       {user && <span className="mt-5 text-xs font-black uppercase truncate w-36 text-center italic text-slate-500 group-hover:text-white transition-colors tracking-widest">{user.apellido}</span>}
    </div>
  );
}

function VotacionView({ state, user, isPres, master, customVoteTopic, setCustomVoteTopic }: any) {
  const votes = state.users.filter(u=>u.presente);
  const yes = votes.reduce((acc, u) => acc + (u.votoActual === 'YES' ? (u.votoDobleEjercido ? 2 : 1) : 0), 0);
  const no = votes.reduce((acc, u) => acc + (u.votoActual === 'NO' ? 1 : 0), 0);
  const abs = votes.filter(u=>u.votoActual === 'ABSTAIN').length;

  return (
    <div className="space-y-12">
       {isPres && (
         <div className="bg-[#0a1120] p-12 rounded-[4rem] border-2 border-amber-600/30 space-y-8 shadow-premium">
            <h3 className="text-4xl font-black italic uppercase gold-gradient-text tracking-tighter">Nueva Votación Nominal</h3>
            <div className="flex gap-8">
               <input value={customVoteTopic} onChange={e=>setCustomVoteTopic(e.target.value)} placeholder="Tópico o Expediente a considerar..." className="flex-1 bg-black/60 p-8 rounded-[2rem] border border-white/10 font-bold text-2xl text-white outline-none focus:border-amber-600" />
               <button onClick={() => { if(customVoteTopic) master.createVote(customVoteTopic, null); setCustomVoteTopic(''); }} className="bg-emerald-600 px-16 rounded-[2rem] font-black uppercase text-sm border-b-8 border-emerald-950 italic hover:scale-105 transition-all">Lanzar Escrutinio</button>
            </div>
         </div>
       )}

       {state.activeVoteTopic ? (
         <div className="bg-[#0a1120] p-16 rounded-[6rem] border-2 border-amber-600/30 text-center space-y-16 shadow-premium relative overflow-hidden animate-in">
            <div className="absolute top-0 right-0 p-16 opacity-[0.05] -rotate-12"><Vote size={350}/></div>
            <div className="space-y-4 relative z-10">
               <p className="text-amber-500 font-black uppercase tracking-[0.6em] text-2xl italic">Escrutinio Nominal en Proceso:</p>
               <h3 className="text-[7.5rem] font-black italic uppercase gold-gradient-text tracking-tighter leading-none">"{state.activeVoteTopic}"</h3>
            </div>
            <div className="grid grid-cols-3 gap-14 relative z-10">
               <VoteBtn label="SÍ" active={user.votoActual === 'YES'} onClick={() => db.get('users').get(user.id).put({ votoActual: 'YES' })} color="bg-emerald-600" />
               <VoteBtn label="NO" active={user.votoActual === 'NO'} onClick={() => db.get('users').get(user.id).put({ votoActual: 'NO' })} color="bg-rose-700" />
               <VoteBtn label="ABS" active={user.votoActual === 'ABSTAIN'} onClick={() => db.get('users').get(user.id).put({ votoActual: 'ABSTAIN' })} color="bg-amber-600" />
            </div>
            <div className="flex justify-center gap-32 pt-16 border-t border-white/5 relative z-10">
               <ResultStat val={yes} label="AFIRMATIVOS" color="text-emerald-500" />
               <ResultStat val={no} label="NEGATIVOS" color="text-rose-600" />
               <ResultStat val={abs} label="ABSTENCIONES" color="text-amber-500" />
            </div>
            {isPres && (
              <div className="flex gap-10 pt-16 relative z-10">
                 <button onClick={() => db.get('users').get(user.id).put({ votoDobleEjercido: !user.votoDobleEjercido })} className={`flex-1 py-10 rounded-[3rem] font-black uppercase italic border-b-8 transition-all ${user.votoDobleEjercido ? 'bg-purple-600 text-white border-purple-950' : 'bg-slate-800 text-slate-500 border-slate-950'}`}>Facultad Voto Doble</button>
                 <button onClick={master.finishVote} className="flex-[2] py-10 bg-white text-slate-900 rounded-[3rem] font-black uppercase text-3xl italic shadow-premium border-b-8 border-slate-300 active:translate-y-2 active:border-b-0 transition-all">Sellar y Registrar Acta</button>
              </div>
            )}
         </div>
       ) : <p className="text-center py-60 italic text-slate-700 font-black text-6xl uppercase opacity-20 tracking-tighter">Silencio Parlamentario</p>}
    </div>
  );
}

function OratoriaView({ state, isPres, master, user }: any) {
  const requests = state.users.filter(u => u.pedirPalabra === 'ESPERA');
  const fmtTimer = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  const currentSpeaker = state.users.find(u => u.id === state.speakerId);

  return (
    <div className="space-y-12">
       <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Control de Oratoria</h2>
       
       <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Cronómetro Global */}
          <div className="bg-[#0a1120] p-12 rounded-[4.5rem] border-2 border-sky-600/30 flex flex-col items-center justify-center text-center space-y-6 shadow-premium relative overflow-hidden">
             {state.speakerId && <div className="absolute inset-0 bg-sky-500/5 animate-pulse"></div>}
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Tiempo Restante</p>
             <p className={`text-[10rem] font-mono font-black ${state.speakerTimer < 30 ? 'text-rose-600 animate-pulse' : 'text-sky-500'} leading-none tabular-nums`}>
                {fmtTimer(state.speakerTimer)}
             </p>
             <p className="text-xl font-black text-white uppercase italic">{currentSpeaker ? `${currentSpeaker.apellido} (B${currentSpeaker.banca})` : 'MICROFONO CERRADO'}</p>
             {isPres && state.speakerId && <button onClick={() => master.revokeWord(state.speakerId)} className="w-full py-5 bg-rose-700 text-white rounded-2xl font-black uppercase text-[10px] border-b-8 border-rose-950">Finalizar Oratoria</button>}
          </div>

          {/* Solicitudes (Solo para Presidencia) */}
          <div className="md:col-span-2 bg-[#0a1120] p-12 rounded-[4.5rem] border border-white/5 space-y-8 shadow-premium">
             <h3 className="text-3xl font-black gold-gradient-text uppercase italic tracking-tighter flex items-center gap-4"><Mic2/> Solicitudes de Palabra</h3>
             <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-4">
                {requests.map(r => (
                  <div key={r.id} className="p-8 bg-black/40 rounded-[2.5rem] border border-white/5 flex justify-between items-center group hover:border-sky-600/30 transition-all">
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 bg-sky-600 rounded-2xl flex items-center justify-center font-black text-white text-2xl italic shadow-xl">B{r.banca}</div>
                       <div>
                          <h4 className="text-3xl font-black italic uppercase text-slate-100">{r.apellido}, {r.nombre}</h4>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{r.cargo}</p>
                       </div>
                    </div>
                    {isPres && (
                      <div className="flex gap-4">
                         <button onClick={() => master.grantWord(r.id)} className="p-5 bg-emerald-600 text-white rounded-2xl hover:scale-105 transition-all shadow-xl"><Check size={24}/></button>
                         <button onClick={() => db.get('users').get(r.id).put({ pedirPalabra: 'NINGUNO' })} className="p-5 bg-rose-700 text-white rounded-2xl hover:scale-105 transition-all shadow-xl"><X size={24}/></button>
                         <button onClick={() => db.get('users').get(r.id).put({ pedirPalabra: 'ESPERAR' })} className="p-5 bg-amber-600 text-white rounded-2xl hover:scale-105 transition-all shadow-xl"><RotateCcw size={24}/></button>
                      </div>
                    )}
                  </div>
                ))}
                {requests.length === 0 && <p className="text-center py-20 opacity-20 italic text-3xl font-black uppercase tracking-tighter">Sin solicitudes pendientes</p>}
             </div>
          </div>
       </div>
    </div>
  );
}

function LoginView({ dni, setDni, onLogin }: any) {
  const [showDni, setShowDni] = useState(false);
  return (
    <div className="h-screen bg-[#020617] flex items-center justify-center relative overflow-hidden font-['Inter']">
      {/* Fondo Animado de Alta Gama */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]"></div>
        <img src={SYMBOLS.ARG_SHIELD} className="absolute inset-0 m-auto h-[80vh] opacity-[0.03] grayscale brightness-150 pointer-events-none" />
      </div>

      <div className="w-full max-w-2xl bg-[#0a1120]/60 backdrop-blur-3xl p-16 rounded-[4rem] border border-white/10 shadow-premium z-10 relative space-y-12 animate-in">
        <div className="flex flex-col items-center gap-8">
           <div className="w-40 h-40 bg-black/40 rounded-[3rem] p-6 border border-amber-600/30 shadow-gold-soft flex items-center justify-center">
              <img src={SYMBOLS.ARG_SHIELD} className="h-28 w-auto drop-shadow-[0_0_20px_rgba(212,175,55,0.6)]" />
           </div>
           <div className="text-center">
              <h1 className="text-6xl font-black uppercase gold-gradient-text tracking-tighter leading-none italic">Soberanía Digital</h1>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[1em] mt-4 ml-3 italic">Parlamento Familiar v.5.5</p>
           </div>
        </div>

        <div className="space-y-10">
           <div className="relative group">
              <Fingerprint className="absolute left-10 top-1/2 -translate-y-1/2 text-amber-600 opacity-50 group-focus-within:opacity-100 transition-opacity" size={36} />
              <input 
                type={showDni ? "text" : "password"} 
                placeholder="Identificación D.N.I." 
                value={dni} 
                onChange={e => setDni(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && onLogin()}
                className="w-full bg-black/40 border border-white/10 p-10 pl-24 rounded-[3rem] text-white font-black text-5xl text-center italic focus:border-amber-600 outline-none transition-all tabular-nums shadow-inner placeholder:text-slate-800" 
              />
              <button onClick={() => setShowDni(!showDni)} className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                 {showDni ? <X size={24}/> : <Eye size={24}/>}
              </button>
           </div>
           
           <button 
             onClick={onLogin} 
             className="w-full py-10 bg-amber-600 text-white rounded-[3.5rem] font-black uppercase text-4xl shadow-gold-soft border-b-[15px] border-amber-950 active:translate-y-2 active:border-b-0 transition-all italic tracking-[0.2em] group flex items-center justify-center gap-6"
           >
             Ingresar al Recinto <ChevronRight size={40} className="group-hover:translate-x-2 transition-transform" />
           </button>
        </div>

        <div className="flex justify-center gap-10 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
           <div className="w-3 h-3 rounded-full bg-amber-600 shadow-[0_0_10px_#d4af37]"></div>
           <div className="w-3 h-3 rounded-full bg-blue-600 shadow-[0_0_10px_#2563eb]"></div>
           <div className="w-3 h-3 rounded-full bg-amber-600 shadow-[0_0_10px_#d4af37]"></div>
        </div>
      </div>
      
      <div className="absolute bottom-10 text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] italic">Puerto Esperanza · Misiones · República Argentina</div>
    </div>
  );
}

function ProjectionScreen({ state, time }: any) {
  return (
    <div className="w-full h-full bg-white text-[#0a1120] flex flex-col p-24 relative overflow-hidden font-['Inter']">
       <header className="flex justify-between items-start border-b-[25px] border-[#0a1120] pb-24 mb-28 relative z-10">
          <div className="flex items-center gap-20">
             <img src={SYMBOLS.ARG_SHIELD} className="h-56 w-auto" />
             <div className="text-left">
                <h1 className="text-[8rem] font-black uppercase leading-none tracking-tighter mb-6">Parlamento Familiar</h1>
                <p className="text-5xl font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">SISTEMA SOBERANO DE GESTIÓN SUPREMA</p>
                <div className="flex items-center gap-12 mt-12">
                   <span className="px-16 py-5 bg-[#0a1120] text-white rounded-full text-4xl font-black uppercase italic shadow-2xl">QUÓRUM REAL: {state.users.filter((u:any)=>u.presente).length} / {state.users.length}</span>
                   {state.candleLit && <Flame size={80} className="text-amber-500 animate-pulse drop-shadow-[0_0_30px_#fbbf24]" />}
                   {state.investitureDone && <Stamp size={80} className="text-purple-600 drop-shadow-[0_0_30px_#a855f7]" />}
                </div>
             </div>
          </div>
          <div className="text-right">
             <p className="text-[13rem] font-mono font-black text-[#0a1120] leading-none mb-8 tabular-nums tracking-tighter">{time.toLocaleTimeString()}</p>
             <p className="text-6xl font-black text-amber-600 uppercase tracking-[0.4em] italic">PUERTO ESPERANZA - MISIONES</p>
          </div>
       </header>

       <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center animate-in">
          {state.projectionMode === 'VELA' && (
             <div className="space-y-24 animate-in">
                <img src={SYMBOLS.VELA} className="h-[50rem] w-auto mx-auto mb-16 drop-shadow-2xl animate-pulse" />
                <h2 className="text-[17rem] font-black italic uppercase leading-none tracking-tighter text-[#0a1120]">LA VELA ESTÁ ENCENDIDA</h2>
                <p className="text-[5rem] font-serif italic text-slate-400">"Guía Moral y Sabiduría en la Deliberación"</p>
             </div>
          )}
          {state.projectionMode === 'JUICIO' && (
             <div className="space-y-28 animate-in">
                <AlertTriangle size={600} className="mx-auto text-rose-800 animate-pulse" />
                <h2 className="text-[18rem] font-black italic uppercase leading-none tracking-tighter text-rose-800">JUICIO POLÍTICO EN CURSO</h2>
             </div>
          )}
          {state.projectionMode === 'CUARTO_INTERMEDIO' && (
             <div className="space-y-24 animate-in">
                <RotateCcw size={400} className="mx-auto text-sky-800 animate-spin-slow opacity-20" />
                <h2 className="text-[16rem] font-black italic uppercase leading-none tracking-tighter text-sky-800">CUARTO INTERMEDIO</h2>
                <p className="text-7xl font-serif italic text-slate-400">La sesión se encuentra pausada por decisión de Presidencia.</p>
             </div>
          )}
          {state.projectionMode === 'LOGO' && (
             <div className="animate-pulse opacity-[0.03] scale-150">
                <img src={SYMBOLS.ARG_SHIELD} className="h-[60rem] w-auto mx-auto" />
             </div>
          )}
          <h2 className="text-[22rem] font-black uppercase italic opacity-[0.07] absolute bottom-10 tracking-tighter">{state.projectionMode !== 'LOGO' ? state.projectionMode : ''}</h2>
       </div>
    </div>
  );
}

function BajasView({ state, isPres }: any) {
  const inactiveUsers = state.users.filter(u => !u.habilitado);
  return (
    <div className="space-y-12">
       <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Exclusiones y Bajas</h2>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {inactiveUsers.map(u => (
            <div key={u.id} className="p-12 bg-rose-900/10 rounded-[4rem] border-2 border-rose-600/30 flex flex-col items-center text-center space-y-6 shadow-premium relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-rose-600 px-10 py-3 text-[10px] font-black uppercase rotate-45 translate-x-10 translate-y-6 shadow-xl">INHABILITADO</div>
               <div className="w-24 h-24 bg-rose-600 rounded-[2.5rem] flex items-center justify-center font-black text-white text-4xl italic shadow-2xl">B{u.banca}</div>
               <div>
                  <h4 className="text-4xl font-black italic uppercase text-slate-100">{u.apellido}, {u.nombre}</h4>
                  <p className="text-sm font-black text-rose-500 uppercase tracking-widest mt-2">{u.cargo}</p>
               </div>
               <div className="pt-6 border-t border-white/5 w-full text-xs font-serif italic text-slate-500 leading-relaxed">
                  Este miembro ha sido excluido del parlamento de forma temporal o permanente por decisión del Tribunal.
               </div>
            </div>
          ))}
          {inactiveUsers.length === 0 && <p className="text-center col-span-3 py-40 opacity-20 italic text-5xl font-black uppercase tracking-tighter leading-none">Sin miembros excluidos<br/>Integridad total del recinto.</p>}
       </div>
    </div>
  );
}

// --- Componentes Adicionales Faltantes ---

/**
 * Vista para proyectos y mociones.
 */
function LegislativeView({ title, type, state, user, master, onSelect }: any) {
  const items = state.projects.filter((p: any) => p.tipo === type);
  return (
    <div className="space-y-12">
      <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {items.map((p: any) => (
          <div key={p.id} className="bg-[#0a1120] p-10 rounded-[3.5rem] border border-white/5 space-y-6 hover:border-amber-600/30 transition-all cursor-pointer group" onClick={() => onSelect(p)}>
            <div className="flex justify-between items-start">
              <span className="px-4 py-1 bg-amber-600/20 text-amber-500 rounded-full text-[10px] font-black uppercase tracking-widest italic">{p.numero}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{p.fecha}</span>
            </div>
            <h3 className="text-3xl font-black italic uppercase text-slate-100 group-hover:text-amber-500 transition-colors">"{p.titulo}"</h3>
            <p className="text-sm font-serif italic text-slate-400 line-clamp-2">{p.articulado}</p>
            <div className="pt-6 border-t border-white/5 flex justify-between items-center">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Iniciador: {p.autor}</span>
               <ChevronRight className="text-amber-500" />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="col-span-2 text-center py-40 opacity-20 italic text-5xl font-black uppercase tracking-tighter">Mesa Vacía</p>}
      </div>
    </div>
  );
}

/**
 * Vista del Orden del Día.
 */
function OrdenDiaView({ state, isPres, master, onSelect }: any) {
  return (
    <div className="space-y-12">
      <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Orden del Día</h2>
      <div className="space-y-6">
        {state.ordenDia.map((p: any) => (
          <div key={p.id} className="bg-[#0a1120] p-8 rounded-[3rem] border border-white/5 flex justify-between items-center group hover:border-sky-600/30 transition-all cursor-pointer" onClick={() => onSelect(p)}>
            <div className="flex items-center gap-10">
               <div className="w-20 h-20 bg-sky-600 rounded-[2rem] flex items-center justify-center font-black text-white text-3xl italic shadow-xl">{p.numero}</div>
               <div>
                  <h4 className="text-4xl font-black italic uppercase text-slate-100 group-hover:text-sky-500 transition-colors">"{p.titulo}"</h4>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mt-2">Estado: {p.estado} | Autor: {p.autor}</p>
               </div>
            </div>
            <ChevronRight className="text-sky-500" size={40} />
          </div>
        ))}
        {state.ordenDia.length === 0 && <p className="text-center py-40 opacity-20 italic text-5xl font-black uppercase tracking-tighter">Sin Asuntos Pendientes</p>}
      </div>
    </div>
  );
}

/**
 * Vista de comisiones y autoridades.
 */
function ComisionesView({ state, isPres, master, setEditingComision, user }: any) {
  return (
    <div className="space-y-12">
      <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Autoridades y Comisiones</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {state.comisiones.map((c: any) => (
          <div key={c.id} className="bg-[#0a1120] p-12 rounded-[4rem] border border-white/5 space-y-8 shadow-premium relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-white/5 pb-6">
               <h3 className="text-4xl font-black italic uppercase text-slate-100">{c.nombre}</h3>
               {isPres && <button onClick={() => setEditingComision(c.id)} className="p-4 bg-amber-600/10 text-amber-500 rounded-2xl hover:bg-amber-600 hover:text-white transition-all"><Settings size={20}/></button>}
            </div>
            <div className="space-y-4">
               <DesignationBadge label="Presidencia" user={state.users.find((u:any)=>u.id===c.presidenteId)} />
               <DesignationBadge label="Vicepresidencia 1º" user={state.users.find((u:any)=>u.id===c.vice1Id)} />
               <DesignationBadge label="Vicepresidencia 2º" user={state.users.find((u:any)=>u.id===c.vice2Id)} />
            </div>
          </div>
        ))}
        {isPres && (
           <button onClick={() => setEditingComision(`c-${Date.now()}`)} className="bg-white/5 p-12 rounded-[4rem] border-4 border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500 hover:border-amber-600/40 hover:text-amber-500 transition-all gap-4">
              <Plus size={60} />
              <span className="font-black uppercase italic tracking-widest text-sm">Establecer Nueva Comisión</span>
           </button>
        )}
      </div>
    </div>
  );
}

/**
 * Vista de tribunal de ética.
 */
function EticaView({ state, isPres, master, user }: any) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [conse, setConse] = useState('');
  const target = state.users.find((u:any)=>u.id===selectedUser);

  return (
    <div className="space-y-12">
      <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Tribunal de Ética</h2>
      {isPres && (
        <div className="bg-[#0a1120] p-16 rounded-[4.5rem] border-2 border-rose-600/30 space-y-10 shadow-premium">
           <div className="grid grid-cols-2 gap-10">
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Magistrado / Legislador a Sumariar</label>
                 <select value={selectedUser || ''} onChange={e=>setSelectedUser(e.target.value)} className="w-full bg-black/40 p-8 rounded-[2.5rem] border border-white/10 text-white font-bold outline-none focus:border-rose-600 appearance-none">
                    <option value="">Seleccionar del Recinto...</option>
                    {state.users.map((u:any)=><option key={u.id} value={u.id}>{u.apellido}, {u.nombre} (B{u.banca})</option>)}
                 </select>
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Infracción Cometida</label>
                 <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ej: Falta de decoro..." className="w-full bg-black/40 p-8 rounded-[2.5rem] border border-white/10 text-white font-bold outline-none focus:border-rose-600" />
              </div>
           </div>
           <textarea value={conse} onChange={e=>setConse(e.target.value)} placeholder="Consecuencia disciplinaria inmediata o recomendación del cuerpo..." className="w-full bg-black/40 p-8 rounded-[2.5rem] border border-white/10 text-white font-bold outline-none focus:border-rose-600 h-32" />
           <div className="flex gap-8">
              <button onClick={() => { if(selectedUser && motivo) master.applySanction(selectedUser, motivo, conse); setMotivo(''); setConse(''); }} className="flex-1 py-10 bg-rose-700 text-white rounded-[3rem] font-black uppercase text-2xl italic shadow-xl border-b-[12px] border-rose-950">Aplicar Sanción Directa</button>
           </div>
        </div>
      )}
      {state.projectionMode === 'JUICIO' && target && (
        <div className="bg-black/60 p-16 rounded-[4rem] border-4 border-rose-600 animate-pulse space-y-10 text-center">
           <h3 className="text-6xl font-black uppercase italic text-rose-500">Sentencia en Cámara</h3>
           <p className="text-3xl text-slate-300 italic font-serif">Se juzga la conducta de {target.apellido} por acumulación de faltas.</p>
           <div className="grid grid-cols-4 gap-6">
              <SentenciaBtn label="Inocente" color="bg-emerald-600" onClick={()=>master.dictarSentencia(target.id, 'INOCENTE', 'Sin cargos.')} />
              <SentenciaBtn label="Apercibimiento" color="bg-amber-600" onClick={()=>master.dictarSentencia(target.id, 'APERCIBIMIENTO', 'Llamado al orden.')} />
              <SentenciaBtn label="Expulsión 5d" color="bg-orange-700" onClick={()=>master.dictarSentencia(target.id, 'EXPULSION_TEMPORAL', 'Expulsión del recinto por 5 días.')} />
              <SentenciaBtn label="Expulsión Permanente" color="bg-rose-900" onClick={()=>master.dictarSentencia(target.id, 'EXPULSION_PERMANENTE', 'Expulsión definitiva.')} />
           </div>
        </div>
      )}
    </div>
  );
}

/**
 * Vista de antecedentes disciplinarios.
 */
function AntecedentesView({ state, user, isPres }: any) {
  const usersWithHistory = state.users.filter((u:any) => (u.sanciones && JSON.parse(u.sanciones).length > 0) || (u.sentencias && JSON.parse(u.sentencias).length > 0));
  return (
    <div className="space-y-12">
      <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Registro de Antecedentes</h2>
      <div className="space-y-8">
        {usersWithHistory.map((u: any) => {
          const sanctions = JSON.parse(u.sanciones || '[]');
          const sentences = JSON.parse(u.sentencias || '[]');
          return (
            <div key={u.id} className="bg-[#0a1120] p-12 rounded-[4rem] border border-white/5 space-y-8 shadow-premium">
               <div className="flex justify-between items-center border-b border-white/5 pb-6">
                  <h3 className="text-4xl font-black italic uppercase text-slate-100">{u.apellido}, {u.nombre} (Banca {u.banca})</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest italic ml-4">Sanciones Activas ({sanctions.length})</p>
                     {sanctions.map((s:any) => (
                       <div key={s.id} className="p-6 bg-rose-950/20 rounded-3xl border border-rose-900/30">
                          <p className="text-sm font-black text-white uppercase italic">{s.motivo}</p>
                          <p className="text-[10px] text-slate-500 uppercase mt-2">{s.fecha} - Por {s.autoridad}</p>
                       </div>
                     ))}
                  </div>
                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest italic ml-4">Sentencias Firmes ({sentences.length})</p>
                     {sentences.map((s:any) => (
                       <div key={s.id} className="p-6 bg-sky-950/20 rounded-3xl border border-sky-900/30">
                          <p className="text-sm font-black text-white uppercase italic">{s.veredicto}</p>
                          <p className="text-[10px] text-slate-500 uppercase mt-2">{s.fecha} - Juez {s.juez}</p>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          );
        })}
        {usersWithHistory.length === 0 && <p className="text-center py-40 opacity-20 italic text-5xl font-black uppercase tracking-tighter">Honorable Cuerpo Sin Mancha</p>}
      </div>
    </div>
  );
}

/**
 * Vista de archivo histórico de votaciones.
 */
function HistoryView({ state, onSelect }: any) {
  return (
    <div className="space-y-12">
      <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Archivo Histórico</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         {state.archivosHistoricos.map((h: any) => (
           <div key={h.id} className="bg-[#0a1120] p-10 rounded-[3.5rem] border border-white/5 space-y-6 hover:border-amber-600/30 transition-all cursor-pointer group shadow-2xl" onClick={() => onSelect(h)}>
              <div className="flex justify-between items-start">
                 <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${h.resultado === 'APROBADO' ? 'bg-emerald-600/20 text-emerald-500' : 'bg-rose-700/20 text-rose-600'}`}>{h.resultado}</span>
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{h.fecha}</span>
              </div>
              <h3 className="text-2xl font-black italic uppercase text-slate-200 group-hover:text-amber-500 transition-colors">"{h.titulo}"</h3>
              <div className="pt-6 border-t border-white/5 flex items-center justify-between text-slate-500">
                 <div className="flex gap-4">
                    <span className="text-[10px] font-black">SI: {h.votosSi}</span>
                    <span className="text-[10px] font-black">NO: {h.votosNo}</span>
                 </div>
                 <ChevronRight size={16}/>
              </div>
           </div>
         ))}
         {state.archivosHistoricos.length === 0 && <p className="col-span-3 text-center py-40 opacity-20 italic text-5xl font-black uppercase tracking-tighter">Sin Crónicas Registradas</p>}
      </div>
    </div>
  );
}

/**
 * Vista de lista de quórum.
 */
function UserListView({ state, isPres }: any) {
  return (
    <div className="space-y-12">
      <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Quórum y Lista</h2>
      <div className="bg-[#0a1120] p-12 rounded-[5rem] border border-white/5 shadow-premium">
         <table className="w-full text-left">
            <thead>
               <tr className="border-b border-white/5 text-[11px] font-black text-amber-500 uppercase tracking-[0.3em] italic">
                  <th className="p-8">Banca</th>
                  <th className="p-8">Legislador</th>
                  <th className="p-8">Cargo</th>
                  <th className="p-8">Estado</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
               {state.users.map((u:any) => (
                 <tr key={u.id} className="group hover:bg-white/5 transition-colors">
                    <td className="p-8 text-4xl font-black italic text-slate-500 group-hover:text-white transition-colors">{u.banca}</td>
                    <td className="p-8 font-black uppercase text-xl text-slate-200">{u.apellido}, {u.nombre}</td>
                    <td className="p-8 text-xs font-black text-slate-500 uppercase italic tracking-widest">{u.cargo}</td>
                    <td className="p-8">
                       <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${u.presente ? 'bg-emerald-600 text-white' : 'bg-rose-950 text-rose-500'}`}>{u.presente ? 'PRESENTE' : 'AUSENTE'}</span>
                    </td>
                 </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
}

/**
 * Vista de control de televisión y proyección.
 */
function TVSessionView({ state, setFullScreenProj, isPres, master }: any) {
  return (
    <div className="space-y-12">
       <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Emisión de Sesión</h2>
       <div className="bg-[#0a1120] p-16 rounded-[5rem] border border-white/5 flex flex-col items-center gap-12 shadow-premium">
          <div className="w-full aspect-video bg-black rounded-[3rem] overflow-hidden border-4 border-amber-600/20 shadow-inner relative group">
             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 z-20">
                <button onClick={() => setFullScreenProj(true)} className="p-10 bg-amber-600 text-white rounded-full shadow-gold-soft hover:scale-110 transition-all"><Maximize size={64}/></button>
             </div>
             <div className="scale-[0.25] origin-top-left absolute inset-0 w-[400%] h-[400%] pointer-events-none">
                <ProjectionScreen state={state} time={state.currentTime} />
             </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full">
             <ActionBtn label="Cerrar TV" color="bg-rose-800" onClick={() => master.setProjection('LOGO')} icon={<StopCircle/>} />
             <ActionBtn label="Logo" color="bg-slate-800" onClick={() => master.setProjection('LOGO')} icon={<Landmark/>} />
             <ActionBtn label="Vela" color="bg-amber-700" onClick={() => master.setProjection('VELA')} icon={<Flame/>} />
             <ActionBtn label="Cuarto Intermedio" color="bg-sky-800" onClick={() => master.setProjection('CUARTO_INTERMEDIO')} icon={<RotateCcw/>} />
          </div>
       </div>
    </div>
  );
}

/**
 * Vista de administración de sesión.
 */
function AdminView({ state, master }: any) {
  const [sessionNum, setSessionNum] = useState(state.sessionNumber);
  const [sessionType, setSessionType] = useState(state.sessionType);

  return (
    <div className="space-y-12">
      <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Administración del Recinto</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
         <div className="bg-[#0a1120] p-12 rounded-[4rem] border border-white/5 space-y-8 shadow-premium">
            <h3 className="text-3xl font-black italic uppercase text-slate-100 border-b border-white/5 pb-4">Control de Sesión</h3>
            <div className="space-y-6">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase ml-4">Nº Sesión</label>
                     <input value={sessionNum} onChange={e=>setSessionNum(e.target.value)} className="w-full bg-black/40 p-6 rounded-2xl border border-white/10 text-white font-bold" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase ml-4">Tipo</label>
                     <select value={sessionType} onChange={e=>setSessionType(e.target.value as any)} className="w-full bg-black/40 p-6 rounded-2xl border border-white/10 text-white font-bold">
                        <option value="ORDINARIA">Ordinaria</option>
                        <option value="EXTRAORDINARIA">Extraordinaria</option>
                        <option value="ESPECIAL">Especial</option>
                        <option value="SOLEMNE">Solemne</option>
                     </select>
                  </div>
               </div>
               <div className="flex gap-4">
                  <button onClick={() => db.get('global').put({ status: 'ABIERTA', sessionNumber: sessionNum, sessionType: sessionType })} className="flex-1 py-6 bg-emerald-600 text-white rounded-[2rem] font-black uppercase italic border-b-8 border-emerald-950">Abrir Sesión</button>
                  <button onClick={() => db.get('global').put({ status: 'CERRADA' })} className="flex-1 py-6 bg-rose-700 text-white rounded-[2rem] font-black uppercase italic border-b-8 border-rose-950">Cerrar Sesión</button>
               </div>
            </div>
         </div>
         <div className="bg-[#0a1120] p-12 rounded-[4rem] border border-white/5 space-y-8 shadow-premium">
            <h3 className="text-3xl font-black italic uppercase text-slate-100 border-b border-white/5 pb-4">Protocolo y Símbolos</h3>
            <div className="grid grid-cols-2 gap-6">
               <button onClick={master.toggleCandle} className={`p-8 rounded-[2.5rem] font-black uppercase italic border-b-8 transition-all ${state.candleLit ? 'bg-amber-600 text-white border-amber-950' : 'bg-slate-800 text-slate-500 border-slate-950'}`}>Vela de Sabiduría</button>
               <button onClick={master.toggleInvestiture} className={`p-8 rounded-[2.5rem] font-black uppercase italic border-b-8 transition-all ${state.investitureDone ? 'bg-purple-600 text-white border-purple-950' : 'bg-slate-800 text-slate-500 border-slate-950'}`}>Investidura</button>
            </div>
         </div>
      </div>
    </div>
  );
}

/**
 * Vista de himnos nacionales y regionales.
 */
function HimnosView({ master, isPres }: any) {
  return (
    <div className="space-y-12">
       <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Himnos Patrios</h2>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {Object.entries(HIMNOS).map(([key, h]: any) => (
            <div key={key} className="bg-[#0a1120] p-12 rounded-[4rem] border border-white/5 flex flex-col items-center text-center space-y-8 shadow-premium group hover:border-sky-500/30 transition-all">
               <div className="p-8 bg-sky-600/10 rounded-[3rem] text-sky-500 group-hover:scale-110 transition-transform">
                  <Music size={60} />
               </div>
               <h3 className="text-3xl font-black italic uppercase text-slate-100">{h.titulo}</h3>
               {isPres && (
                 <button onClick={() => master.setProjection(`HIMNO_${key}` as any)} className="w-full py-6 bg-sky-600 text-white rounded-[2rem] font-black uppercase text-xs italic shadow-xl border-b-8 border-sky-950">Proyectar Himno</button>
               )}
               <a href={h.url} target="_blank" className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">Reproducir en Dispositivo</a>
            </div>
          ))}
       </div>
    </div>
  );
}

/**
 * Vista de prensa oficial.
 */
function PrensaView({ state, isPres, user }: any) {
  const news = state.news;
  return (
    <div className="space-y-12">
      <h2 className="text-7xl font-black italic gold-gradient-text text-center tracking-tighter uppercase leading-none">Prensa y Comunicados</h2>
      <div className="space-y-8">
         {news.map((n: any) => (
           <div key={n.id} className="bg-[#0a1120] p-16 rounded-[5rem] border-l-[30px] border-indigo-600 shadow-premium group">
              <div className="flex justify-between items-start mb-8">
                 <span className="px-6 py-2 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest italic">Boletín Oficial</span>
                 <span className="text-xs font-black text-slate-500 uppercase">{n.fecha}</span>
              </div>
              <h3 className="text-6xl font-black italic uppercase text-slate-100 group-hover:text-indigo-400 transition-colors mb-6 tracking-tighter">"{n.titulo}"</h3>
              <p className="text-3xl font-serif italic text-slate-300 leading-relaxed line-clamp-3">{n.articulado}</p>
           </div>
         ))}
         {news.length === 0 && <p className="text-center py-40 opacity-20 italic text-5xl font-black uppercase tracking-tighter">Sin Comunicados Recientes</p>}
      </div>
    </div>
  );
}

/**
 * Tarjeta de detalle para el historial.
 */
function HistoryDetailCard({ label, val, color }: any) {
  return (
    <div className="bg-black/20 p-8 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center">
       <p className={`text-5xl font-black italic ${color} mb-2`}>{val}</p>
       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
    </div>
  );
}

/**
 * Modal para editar comisiones.
 */
function ComisionEditModal({ comision, users, onClose, onSave }: any) {
  const [data, setData] = useState(comision);
  return (
    <div className="bg-[#0a1120] border-2 border-amber-600/30 w-full max-w-2xl p-16 rounded-[4rem] shadow-premium space-y-10">
       <h3 className="text-4xl font-black italic gold-gradient-text uppercase">Configurar Comisión</h3>
       <div className="space-y-6">
          <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-500 uppercase ml-4 italic">Nombre Institucional</label>
             <input value={data.nombre} onChange={e=>setData({...data, nombre: e.target.value})} className="w-full bg-black/40 p-6 rounded-2xl border border-white/10 text-white font-bold outline-none focus:border-amber-600" />
          </div>
          <div className="grid grid-cols-1 gap-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-4 italic">Titular de Presidencia</label>
                <select value={data.presidenteId || ''} onChange={e=>setData({...data, presidenteId: e.target.value})} className="w-full bg-black/40 p-6 rounded-2xl border border-white/10 text-white font-bold appearance-none">
                   <option value="">Vacante...</option>
                   {users.map((u:any)=><option key={u.id} value={u.id}>{u.apellido}, {u.nombre}</option>)}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-4 italic">Vicepresidencia 1º</label>
                <select value={data.vice1Id || ''} onChange={e=>setData({...data, vice1Id: e.target.value})} className="w-full bg-black/40 p-6 rounded-2xl border border-white/10 text-white font-bold appearance-none">
                   <option value="">Vacante...</option>
                   {users.map((u:any)=><option key={u.id} value={u.id}>{u.apellido}, {u.nombre}</option>)}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-4 italic">Vicepresidencia 2º</label>
                <select value={data.vice2Id || ''} onChange={e=>setData({...data, vice2Id: e.target.value})} className="w-full bg-black/40 p-6 rounded-2xl border border-white/10 text-white font-bold appearance-none">
                   <option value="">Vacante...</option>
                   {users.map((u:any)=><option key={u.id} value={u.id}>{u.apellido}, {u.nombre}</option>)}
                </select>
             </div>
          </div>
          <div className="flex gap-6 pt-6">
             <button onClick={onClose} className="flex-1 py-6 bg-slate-800 text-white rounded-[2rem] font-black uppercase italic">Anular</button>
             <button onClick={() => onSave(data)} className="flex-1 py-6 bg-amber-600 text-white rounded-[2rem] font-black uppercase italic border-b-8 border-amber-950">Refrendar Cambios</button>
          </div>
       </div>
    </div>
  );
}

function MenuBtn({ id, label, icon, active, onClick }: any) {
  const isActive = active === id;
  return (
    <button onClick={() => onClick(id)} className={`w-full flex items-center gap-5 px-8 py-5 rounded-[2rem] text-[11px] font-black uppercase transition-all group ${isActive ? 'bg-amber-600 text-white shadow-gold-soft scale-105 translate-x-3' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}>
      {React.cloneElement(icon, { size: 24 })} 
      <span className="tracking-[0.2em] italic">{label}</span>
    </button>
  );
}

function NavSection({ title, children }: any) {
  return (
    <div className="space-y-4">
       <p className="text-[9px] font-black text-amber-500/40 uppercase tracking-[0.5em] ml-6 italic">{title}</p>
       <div className="space-y-2">{children}</div>
    </div>
  );
}

function VoteBtn({ label, active, onClick, color }: any) {
  return (
    <button onClick={onClick} className={`py-16 rounded-[5rem] font-black text-[10rem] italic transition-all shadow-premium border-b-[20px] active:translate-y-2 active:border-b-0 ${active ? `${color} text-white border-black/40` : 'bg-white/5 text-slate-800 border-transparent opacity-30 hover:opacity-100'}`}>
       {label}
    </button>
  );
}

function ResultStat({ val, label, color }: any) {
  return (
    <div className="space-y-6">
       <p className={`text-[11rem] font-black ${color} tabular-nums leading-none drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]`}>{val}</p>
       <p className="text-xs font-black text-slate-500 uppercase tracking-[0.6em] italic">{label}</p>
    </div>
  );
}

function SessionBadge({ status, type }: any) {
  const c = status === 'ABIERTA' ? 'text-emerald-500 border-emerald-500/30 shadow-emerald-500/10' : 'text-rose-600 border-rose-600/30 shadow-rose-600/10';
  return <div className={`px-10 py-3 rounded-full border-4 font-black uppercase text-[10px] tracking-[0.3em] italic shadow-2xl ${c} bg-black/40`}>SESIÓN {status} | {type}</div>;
}

function DesignationBadge({ label, user }: any) {
  return (
    <div className="flex justify-between items-center px-10 py-6 bg-black/40 rounded-[2.5rem] border border-white/5 shadow-inner">
       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{label}</span>
       <span className="text-3xl font-black italic uppercase text-white truncate max-w-[250px] tracking-tighter">{user?.apellido || 'VACANTE'}</span>
    </div>
  );
}

function ActionBtn({ label, color, onClick, icon }: any) {
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-3 py-8 px-5 ${color} text-white rounded-[2rem] text-[10px] font-black uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all italic border-b-8 border-black/20 tracking-widest`}>
       {icon} {label}
    </button>
  );
}

function SentenciaBtn({ label, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`py-12 rounded-[3.5rem] font-black text-sm uppercase text-white shadow-premium hover:scale-105 transition-all border-b-8 border-black/20 italic tracking-widest ${color}`}>
       {label}
    </button>
  );
}
