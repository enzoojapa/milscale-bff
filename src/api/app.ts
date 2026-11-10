import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { GetAggregatedData } from '../application/get-aggregated-data/GetAggregatedData';
import { CicloGateway, EfetivoGateway, EscalaGateway } from '../application/ports';
import { openApiSpec } from './docs/openapi';
import { getAggregatedDataRoute } from './features/get-aggregated-data.route';
import { proxyRoutes, UrlsServicos } from './features/proxy.routes';

export interface ConfigBff {
  urls: UrlsServicos;
  gateways: { efetivo: EfetivoGateway; escala: EscalaGateway; ciclo: CicloGateway };
  necessidadeDiaria: number;
}

export function buildApp(cfg: ConfigBff): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', servico: 'milscale-bff' });
  });
  app.get('/swagger.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  const agregador = new GetAggregatedData(
    cfg.gateways.efetivo,
    cfg.gateways.escala,
    cfg.gateways.ciclo,
    cfg.necessidadeDiaria,
  );
  app.use(getAggregatedDataRoute(agregador));
  app.use(proxyRoutes(cfg.urls));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno no BFF' });
  });
  return app;
}
