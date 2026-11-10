import { Bloco, PainelAgregado } from '../../domain/Painel';
import { CicloGateway, EfetivoGateway, EscalaGateway } from '../ports';

async function bloco<T>(promessa: Promise<T>): Promise<Bloco<T>> {
  try {
    return { status: 'ok', dados: await promessa };
  } catch (e) {
    return { status: 'erro', dados: null, erro: (e as Error).message };
  }
}

/** Data de hoje no horario de Brasilia (AAAA-MM-DD). */
export function hojeEmBrasilia(agora = new Date()): string {
  return new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export class GetAggregatedData {
  constructor(
    private readonly efetivo: EfetivoGateway,
    private readonly escala: EscalaGateway,
    private readonly ciclo: CicloGateway,
    private readonly necessidadeDiariaPadrao: number,
  ) {}

  async execute(params: { data?: string; necessidadeDiaria?: number } = {}): Promise<PainelAgregado> {
    const inicio = Date.now();
    const data = params.data ?? hojeEmBrasilia();
    const necessidade = params.necessidadeDiaria ?? this.necessidadeDiariaPadrao;

    // Efetivo e escala sao independentes: chamadas em paralelo.
    const efetivoPromise = bloco(this.efetivo.listarMilitares());
    const escalaPromise = bloco(this.escala.listarEscalasDoDia(data));

    // O ciclo depende do numero de aptos que vem do microsservico de efetivo.
    const efetivo = await efetivoPromise;
    const ciclo = efetivo.dados
      ? await bloco(this.ciclo.calcular(efetivo.dados.aptos, necessidade))
      : { status: 'erro' as const, dados: null, erro: 'Ciclo nao calculado: efetivo indisponivel' };

    return {
      data,
      geradoEm: new Date().toISOString(),
      tempoMs: Date.now() - inicio,
      efetivo,
      escala: await escalaPromise,
      ciclo,
    };
  }
}
