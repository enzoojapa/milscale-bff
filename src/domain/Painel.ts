/** Modelos que o frontend consome. O BFF so agrega e adapta; regra de negocio fica nos microsservicos. */

export interface MilitarResumo {
  id: string;
  nomeGuerra: string;
  graduacao: string;
  subunidade: string;
  situacao: string;
  apto: boolean;
}

export interface EfetivoResumo {
  total: number;
  aptos: number;
  militares: MilitarResumo[];
}

export interface EscalaDoDia {
  id: number;
  data: string;
  militarId: string;
  militarNome: string;
  posto: string;
  status: string;
  inicio: string;
  fim: string;
}

export interface CicloCalculado {
  efetivoApto: number;
  necessidadeDiaria: number;
  cicloDias: number;
  folgaEntreServicosDias: number;
  servicosPorMilitarEm30Dias: number;
  sobra: number;
}

export type StatusFonte = 'ok' | 'erro';

export interface Bloco<T> {
  status: StatusFonte;
  dados: T | null;
  erro?: string;
}

export interface PainelAgregado {
  data: string;
  geradoEm: string;
  tempoMs: number;
  efetivo: Bloco<EfetivoResumo>;
  escala: Bloco<{ total: number; escalas: EscalaDoDia[] }>;
  ciclo: Bloco<CicloCalculado>;
}
