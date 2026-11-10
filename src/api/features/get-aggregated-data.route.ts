import { Router } from 'express';
import { GetAggregatedData } from '../../application/get-aggregated-data/GetAggregatedData';

export function getAggregatedDataRoute(useCase: GetAggregatedData): Router {
  return Router().get('/aggregated-data', async (req, res) => {
    const data = typeof req.query.data === 'string' ? req.query.data : undefined;
    const necessidade = req.query.necessidadeDiaria ? Number(req.query.necessidadeDiaria) : undefined;
    if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      res.status(400).json({ erro: 'Parametro data deve estar no formato AAAA-MM-DD' });
      return;
    }
    res.json(await useCase.execute({ data, necessidadeDiaria: necessidade }));
  });
}
