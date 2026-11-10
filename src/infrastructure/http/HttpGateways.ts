import { CicloGateway, EfetivoGateway, EscalaGateway } from '../../application/ports';
import { CicloCalculado, EfetivoResumo, EscalaDoDia, MilitarResumo } from '../../domain/Painel';

const TIMEOUT_MS = 10000;

async function getJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error((corpo as { erro?: string }).erro ?? `HTTP ${resp.status} em ${new URL(url).pathname}`);
  }
  return corpo as T;
}

export class HttpEfetivoGateway implements EfetivoGateway {
  constructor(private readonly baseUrl: string) {}

  async listarMilitares(): Promise<EfetivoResumo> {
    const r = await getJson<{ total: number; aptos: number; militares: MilitarResumo[] }>(`${this.baseUrl}/militares`);
    return {
      total: r.total,
      aptos: r.aptos,
      militares: r.militares.map(({ id, nomeGuerra, graduacao, subunidade, situacao, apto }) => ({
        id,
        nomeGuerra,
        graduacao,
        subunidade,
        situacao,
        apto,
      })),
    };
  }
}

export class HttpEscalaGateway implements EscalaGateway {
  constructor(private readonly baseUrl: string) {}

  async listarEscalasDoDia(data: string): Promise<{ total: number; escalas: EscalaDoDia[] }> {
    return getJson(`${this.baseUrl}/escalas?data=${encodeURIComponent(data)}`);
  }
}

export class HttpCicloGateway implements CicloGateway {
  constructor(private readonly functionUrl: string) {}

  async calcular(efetivoApto: number, necessidadeDiaria: number): Promise<CicloCalculado> {
    return getJson(`${this.functionUrl}/api/ciclo?efetivoApto=${efetivoApto}&necessidadeDiaria=${necessidadeDiaria}`);
  }
}
