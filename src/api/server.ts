import { HttpCicloGateway, HttpEfetivoGateway, HttpEscalaGateway } from '../infrastructure/http/HttpGateways';
import { buildApp } from './app';

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variavel ${nome} nao configurada`);
  return valor.replace(/\/$/, '');
}

const urls = {
  efetivo: obrigatoria('EFETIVO_SERVICE_URL'),
  escala: obrigatoria('ESCALA_SERVICE_URL'),
  function: obrigatoria('FUNCTION_URL'),
};
const port = Number(process.env.PORT ?? 3000);

buildApp({
  urls,
  gateways: {
    efetivo: new HttpEfetivoGateway(urls.efetivo),
    escala: new HttpEscalaGateway(urls.escala),
    ciclo: new HttpCicloGateway(urls.function),
  },
  necessidadeDiaria: Number(process.env.NECESSIDADE_DIARIA ?? 4),
}).listen(port, () => console.log(`milscale-bff rodando na porta ${port}`));
