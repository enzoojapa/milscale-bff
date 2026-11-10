import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { buildApp } from '../../src/api/app';
import { GetAggregatedData, hojeEmBrasilia } from '../../src/application/get-aggregated-data/GetAggregatedData';
import { CicloGateway, EfetivoGateway, EscalaGateway } from '../../src/application/ports';

const efetivoOk: EfetivoGateway = {
  listarMilitares: async () => ({ total: 3, aptos: 2, militares: [] }),
};
const escalaOk: EscalaGateway = {
  listarEscalasDoDia: async () => ({ total: 1, escalas: [] }),
};
const cicloOk: CicloGateway = {
  calcular: async (aptos, nec) => ({
    efetivoApto: aptos,
    necessidadeDiaria: nec,
    cicloDias: Math.floor(aptos / nec),
    folgaEntreServicosDias: 0,
    servicosPorMilitarEm30Dias: 0,
    sobra: 0,
  }),
};

describe('GetAggregatedData', () => {
  it('junta efetivo, escala e ciclo em uma resposta', async () => {
    const r = await new GetAggregatedData(efetivoOk, escalaOk, cicloOk, 1).execute({ data: '2026-11-20' });
    expect(r.data).toBe('2026-11-20');
    expect(r.efetivo.status).toBe('ok');
    expect(r.escala.dados?.total).toBe(1);
    expect(r.ciclo.dados?.efetivoApto).toBe(2);
  });

  it('usa o numero de aptos do efetivo para calcular o ciclo', async () => {
    const calcular = jest.fn(cicloOk.calcular);
    await new GetAggregatedData(efetivoOk, escalaOk, { calcular }, 4).execute();
    expect(calcular).toHaveBeenCalledWith(2, 4);
  });

  it('continua respondendo se uma fonte falhar', async () => {
    const escalaFora: EscalaGateway = { listarEscalasDoDia: async () => { throw new Error('timeout'); } };
    const r = await new GetAggregatedData(efetivoOk, escalaFora, cicloOk, 1).execute();
    expect(r.escala.status).toBe('erro');
    expect(r.efetivo.status).toBe('ok');
  });

  it('nao calcula ciclo sem efetivo', async () => {
    const efetivoFora: EfetivoGateway = { listarMilitares: async () => { throw new Error('fora'); } };
    const r = await new GetAggregatedData(efetivoFora, escalaOk, cicloOk, 1).execute();
    expect(r.ciclo.status).toBe('erro');
  });

  it('calcula a data de hoje no horario de Brasilia', () => {
    expect(hojeEmBrasilia(new Date('2026-11-21T01:00:00Z'))).toBe('2026-11-20');
  });
});

describe('API do BFF', () => {
  let servicoFalso: http.Server;
  let urlFalsa: string;

  beforeAll(async () => {
    servicoFalso = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST') {
        res.statusCode = 201;
        res.end(JSON.stringify({ id: 'abc', recebido: req.url }));
        return;
      }
      res.end(JSON.stringify({ caminho: req.url }));
    });
    await new Promise<void>((ok) => servicoFalso.listen(0, ok));
    urlFalsa = `http://127.0.0.1:${(servicoFalso.address() as AddressInfo).port}`;
  });
  afterAll(() => servicoFalso.close());

  const app = () =>
    buildApp({
      urls: { efetivo: urlFalsa, escala: urlFalsa, function: urlFalsa },
      gateways: { efetivo: efetivoOk, escala: escalaOk, ciclo: cicloOk },
      necessidadeDiaria: 1,
    });

  it('GET /aggregated-data retorna os tres blocos', async () => {
    const r = await request(app()).get('/aggregated-data?data=2026-11-20').expect(200);
    expect(Object.keys(r.body)).toEqual(expect.arrayContaining(['efetivo', 'escala', 'ciclo']));
  });

  it('valida o formato da data', async () => {
    await request(app()).get('/aggregated-data?data=20-11-2026').expect(400);
  });

  it('repassa o CRUD para o microsservico sem o prefixo /api', async () => {
    const r = await request(app()).get('/api/militares?situacao=APTO').expect(200);
    expect(r.body.caminho).toBe('/militares?situacao=APTO');
    const c = await request(app()).post('/api/escalas').send({ data: '2026-11-20' }).expect(201);
    expect(c.body.recebido).toBe('/escalas');
  });

  it('repassa /api/ciclo para a Function mantendo /api', async () => {
    const r = await request(app()).get('/api/ciclo?efetivoApto=24&necessidadeDiaria=4').expect(200);
    expect(r.body.caminho).toBe('/api/ciclo?efetivoApto=24&necessidadeDiaria=4');
  });
});
