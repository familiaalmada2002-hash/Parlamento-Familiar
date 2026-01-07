
import { Role, User, Comision } from './types';

export const ESTATUTO_COMPLETO = `ESTATUTO DEL PARLAMENTO FAMILIAR - SOBERANO
DISTRITO PUERTO ESPERANZA - MISIONES

TÍTULO PRIMERO: DE LA INSTITUCIÓN
Art. 1: El Parlamento Familiar es la máxima expresión de la democracia estudiantil.
Art. 2: Su sede es el Recinto Sagrado de Puerto Esperanza.
Art. 3: La Lista 001 ostenta la Presidencia del Cuerpo.

TÍTULO SEGUNDO: DE LOS SÍMBOLOS
Art. 4: La Vela de Sabiduría debe permanecer encendida durante todo el debate. Simboliza la luz de la verdad.
Art. 5: El Gorro Presidencial representa la investidura y la imparcialidad de quien dirige.

TÍTULO TERCERO: DE LAS SESIONES
Art. 6: El Quórum legal se alcanza con la mitad más uno de los miembros.
Art. 7: Las sesiones son Ordinarias, Extraordinarias, Especiales o Disciplinarias.
Art. 8: Todo miembro tiene derecho al uso de la palabra por un máximo de 5 minutos.

TÍTULO CUARTO: DE LAS SANCIONES
Art. 9: El Tribunal de Honor juzgará faltas al decoro.
Art. 10: Las sanciones incluyen: Expulsión temporal, pérdida de voto, pérdida de palabra o expulsión directa.

TÍTULO QUINTO: DE LAS LEYES
Art. 11: Un proyecto aprobado se convierte en Ley Suprema y se incorpora al Digesto.
Art. 12: Las mociones rechazadas pasan al archivo histórico sin posibilidad de tratamiento en la misma sesión.`;

export const GUIA_PRESIDENCIAL = `GUÍA DE DISCURSO Y PROTOCOLO PRESIDENCIAL

1. APERTURA (Acto de la Vela)
"Siendo las [Hora] y habiendo quórum legal, procedo a encender la Vela de la Sabiduría. ¡Queda abierta la Sesión!"

2. INVESTIDURA
"Solicito al Secretario proceder con mi investidura. (Ponerse el gorro). Asumo el mando del Recinto."

3. HIMNOS
"Póngase de pie la Sala. Entonaremos los Himnos de nuestra Patria, Provincia y Ciudad."

4. ORDEN DEL DÍA
"Secretaría, proceda a la lectura de los asuntos a tratar en el Orden del Día."

5. DAR LA PALABRA
"Tiene la palabra el Legislador [Apellido] por 5 minutos. Su tiempo corre a partir de ahora."

6. INTERRUPCIÓN / SILENCIO
"¡Silencio en el Recinto! Legislador, su tiempo ha concluido o se le retira la palabra por falta de decoro."

7. LLAMADO A VOTACIÓN
"Señores Magistrados, entramos en Votación Nominal sobre el expediente en tratamiento."

8. CIERRE DE SESIÓN
"No habiendo más asuntos que tratar, apago la Vela Parlamentaria. Sesión Levantada. ¡Viva la Patria!"`;

export const HIMNOS = {
  NACIONAL: { titulo: "Himno Nacional Argentino", description: "Símbolo de la Libertad" },
  MISIONES: { titulo: "Misionerita", description: "Orgullo de nuestra Tierra Roja" },
  ESPERANZA: { titulo: "Himno a Puerto Esperanza", description: "Identidad del Norte Misionero" }
};

export const SYMBOLS = {
  ARG_SHIELD: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Coat_of_arms_of_Argentina.svg/1200px-Coat_of_arms_of_Argentina.svg.png',
};

export const INITIAL_COMMISSIONS: Comision[] = [
  { id: 'com-leg', nombre: 'Comisión Legislativa y de Ética', presidenteId: null, vice1Id: null, vice2Id: null, integrantesIds: [] },
  { id: 'com-edu', nombre: 'Comisión de Educación y Cultura', presidenteId: null, vice1Id: null, vice2Id: null, integrantesIds: [] },
  { id: 'com-sal', nombre: 'Comisión de Salud y Deporte', presidenteId: null, vice1Id: null, vice2Id: null, integrantesIds: [] }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'u-presi-001',
    dni: '49993070',
    nombre: 'PRESIDENCIA',
    apellido: 'SOBERANA',
    cargo: Role.PRESIDENTE,
    presente: false,
    habilitado: true,
    votoActual: null,
    pedirPalabra: 'NINGUNO',
    notificacionVista: true,
    banca: 1,
    sanciones: 0,
    sentencias: [],
    clave: '49993070',
    votoDobleEjercido: false
  }
];
