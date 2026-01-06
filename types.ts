
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
  veredicto: 'INOCENTE' | 'EXPULSION_TEMPORAL' | 'EXPULSION_PERMANENTE' | 'APERCIBIMIENTO';
  detalle: string;
  juez: string;
}

export interface Sancion {
  id: string;
  tipo: string;
  motivo: string;
  consecuencia: string;
  fecha: string;
  autoridad: string;
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
  pedirPalabra: 'NINGUNO' | 'ESPERA' | 'CONCEDIDA' | 'ESPERAR';
  sanciones: Sancion[];
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
  estado: 'MESA' | 'ORDEN_DIA' | 'EN_TRATAMIENTO' | 'APROBADO' | 'RECHAZADO' | 'ARCHIVADO' | 'SANCIONADO_IMPLEMENTADO';
  fecha: string;
  tipo: 'LEY' | 'MOCION' | 'DECRETO' | 'HOMENAJE' | 'RESOLUCION' | 'NOTICIA';
  bancaOrigen: number;
  comisionId?: string;
  resultado?: 'APROBADO' | 'RECHAZADO' | 'ARCHIVADO';
  votosSi?: number;
  votosNo?: number;
  votosAbs?: number;
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
  | 'LOGO' | 'APERTURA' | 'VELA' | 'INVESTIDURA' | 'HIMNO_NAC' | 'HIMNO_MIS' 
  | 'HIMNO_PE' | 'DEBATE' | 'VOTACION_CURSO' | 'VOTACION_RESULTADO' | 'SANCION' | 'JUICIO' | 'CIERRE' | 'CUARTO_INTERMEDIO';

export interface AppState {
  users: User[];
  projects: Proyecto[];
  news: Proyecto[];
  ordenDia: Proyecto[];
  archivosHistoricos: Proyecto[];
  archivosGeneral: Proyecto[];
  comisiones: Comision[];
  sessionStatus: 'CERRADA' | 'ABIERTA' | 'CUARTO_INTERMEDIO' | 'PAUSA';
  sessionType: 'ORDINARIA' | 'EXTRAORDINARIA' | 'ESPECIAL' | 'SOLEMNE' | 'DISCIPLINARIA';
  sessionNumber: string;
  candleLit: boolean;
  investitureDone: boolean;
  speakerId: string | null;
  speakerTimer: number;
  activeVoteTopic: string | null;
  activeVoteRefId: string | null;
  manualVotes: { yes: number, no: number, abs: number };
  projectionMode: ProjectionMode;
  lastSanctionedUserId?: string;
  currentTime: Date;
}
