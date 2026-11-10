import { CicloCalculado, EfetivoResumo, EscalaDoDia } from '../domain/Painel';

export interface EfetivoGateway {
  listarMilitares(): Promise<EfetivoResumo>;
}

export interface EscalaGateway {
  listarEscalasDoDia(data: string): Promise<{ total: number; escalas: EscalaDoDia[] }>;
}

export interface CicloGateway {
  calcular(efetivoApto: number, necessidadeDiaria: number): Promise<CicloCalculado>;
}
