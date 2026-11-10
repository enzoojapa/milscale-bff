import { Router } from 'express';
import { proxyPara } from '../../infrastructure/http/proxy';

export interface UrlsServicos {
  efetivo: string;
  escala: string;
  function: string;
}

/** Rotas de CRUD que o frontend usa. Cada prefixo vai para um unico microsservico. */
export function proxyRoutes(urls: UrlsServicos): Router {
  const r = Router();
  r.use('/api/militares', proxyPara(urls.efetivo, '/api'));
  r.use('/api/escalas', proxyPara(urls.escala, '/api'));
  r.use('/api/trocas', proxyPara(urls.escala, '/api'));
  r.use('/api/eventos', proxyPara(urls.escala, '/api'));
  r.use('/api/ciclo', proxyPara(urls.function, ''));
  return r;
}
