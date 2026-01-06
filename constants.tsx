
import { Role, User } from './types';

export const ESTATUTO_COMPLETO = `ESTATUTO DEL PARLAMENTO FAMILIAR - SOBERANO
DISTRITO PUERTO ESPERANZA - MISIONES

TÍTULO PRIMERO: DISPOSICIONES GENERALES
Artículo 1. El Parlamento Familiar es el órgano soberano de deliberación suprema.
Artículo 2. La Vela de la Sabiduría simboliza la guía espiritual y moral de la sesión.
Artículo 5. El Quórum se constituye con la mayoría simple de los miembros registrados y presentes.
Artículo 40. Voto Doble Presidencial. El Presidente tiene la facultad de desempatar con voto doble.
Artículo 300. Régimen Disciplinario. Tres sanciones acumuladas implican el inicio inmediato de un Juicio Político.
Artículo 305. Sentencias. El Tribunal puede dictar inocencia, expulsión temporal de 5 días o expulsión permanente del recinto.
(Documento íntegro de 529 artículos)...`;

export const HIMNOS = {
  NACIONAL: {
    titulo: "Himno Nacional Argentino",
    url: "https://www.youtube.com/watch?v=uTz9Vp1z-j8"
  },
  MISIONES: {
    titulo: "Misionerita",
    url: "https://www.youtube.com/watch?v=N4f8OQp1GEY"
  },
  ESPERANZA: {
    titulo: "Himno de Puerto Esperanza",
    url: "#"
  }
};

export const SYMBOLS = {
  ARG_SHIELD: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Coat_of_arms_of_Argentina.svg/1200px-Coat_of_arms_of_Argentina.svg.png',
  VELA: 'https://cdn-icons-png.flaticon.com/512/414/414594.png',
  GORRO: 'https://cdn-icons-png.flaticon.com/512/3242/3242257.png'
};

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
    banca: 1,
    sanciones: [],
    sentencias: [],
    clave: '49993070',
    votoDobleEjercido: false
  }
];
