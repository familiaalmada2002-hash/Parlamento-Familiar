
export enum Role {
  PRESIDENTE = 'Presidente del Parlamento',
  VICEPRESIDENTE_1 = 'Vicepresidente 1º',
  VICEPRESIDENTE_2 = 'Vicepresidente 2º',
  SECRETARIO = 'Secretario Parlamentario',
  ADMINISTRADOR = 'Administrador de Sistemas',
  LEGISLADOR = 'Miembro / Legislador',
  VISITANTE = 'Visitante / Observador'
}

export type VoteType = 'YES' | 'NO' | 'ABSTAIN' | null;

export interface Sentencia {
  id: string;
  fecha: string;
  veredicto: 'INOCENTE' | 'EXPULSION_5_DIAS' | 'SIN_VOTO_UNA_VEZ' | 'SIN_PALABRA_UNA_VEZ' | 'EXPULSION_DIRECTA';
  detalle: string;
  juez: string;
}

export interface User {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  cargo: Role;
  banca: number; 
  presente: boolean;
  habilitado: boolean;
  votoActual: VoteType;
  pedirPalabra: 'NINGUNO' | 'ESPERA' | 'CONCEDIDA' | 'RECHAZADA' | 'ESPERE_MINUTOS';
  notificacionVista: boolean; // Para que el flash solo aparezca una vez
  sanciones: number;
  sentencias: Sentencia[];
  clave: string;
  votoDobleEjercido: boolean;
}

export interface Proyecto {
  id: string;
  numero: string; 
  titulo: string;
  articulado: string;
  autor: string;
  autorId: string;
  autorDni: string;
  autorBanca: number;
  fecha: string;
  hora: string;
  estado: 'MESA' | 'ORDEN_DIA' | 'EN_TRATAMIENTO' | 'APROBADO' | 'RECHAZADO' | 'ARCHIVADO' | 'IMPLEMENTADO';
  tipo: 'LEY' | 'MOCION' | 'RESOLUCION' | 'NOTICIA';
  sellado: boolean;
  visado: boolean;
}

export interface Acta {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
  hora: string;
  autor: string;
}

export interface Comision {
  id: string;
  nombre: string;
  presidenteId: string | null;
  vice1Id: string | null;
  vice2Id: string | null;
  integrantesIds: string[];
}

export type ProjectionMode = 
  | 'LOGO' | 'APERTURA_INST' | 'VELA_INICIO' | 'INVESTIDURA' | 'HIMNO_NAC' | 'HIMNO_MIS' 
  | 'HIMNO_PE' | 'HOMENAJES_INI' | 'ORDEN_DIA_PROY' | 'USO_PALABRA' | 'MOCIONES_PROY' | 'DEBATE_PROY'
  | 'VOTACION_PREP' | 'VOTACION_CURSO' | 'VOTACION_RESULTADO' | 'VOTO_PRESIDENCIAL' | 'SANCION_PROY' | 'JUICIO_INICIADO'
  | 'CUARTO_INTERMEDIO' | 'HOMENAJES_FIN' | 'AVISOS_INST' | 'CIERRE_SESION' | 'REGISTRO_FINAL'
  | 'SILENCIO' | 'RECONOCIMIENTO' | 'NOMBRAMIENTO' | 'DECLARACION' | 'ESTATUTO_MOD';

export interface AppState {
  users: User[];
  projects: Proyecto[];
  news: Proyecto[];
  ordenDia: Proyecto[];
  actas: Acta[];
  comisiones: Comision[];
  sessionStatus: 'CERRADA' | 'ABIERTA' | 'CUARTO_INTERMEDIO' | 'PAUSA' | 'NO_INICIADA';
  sessionType: 'ORDINARIA' | 'EXTRAORDINARIA' | 'ESPECIAL' | 'SOLEMNE' | 'DISCIPLINARIA';
  sessionNumber: string;
  candleLit: boolean;
  hatOn: boolean;
  speakerId: string | null;
  speakerTimer: number;
  activeVoteTopic: string | null;
  manualVotes: { yes: number, no: number, abs: number };
  projectionMode: ProjectionMode;
  currentTime: Date;
  flashMessage: string | null;
}
