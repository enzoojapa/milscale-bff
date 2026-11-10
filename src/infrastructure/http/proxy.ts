import { Request, Response } from 'express';

/**
 * Repassa a requisicao para um microsservico e devolve status e corpo sem alterar.
 * O BFF nao aplica regra de negocio no CRUD: so encaminha.
 */
export function proxyPara(baseUrl: string, prefixoBff: string) {
  return async (req: Request, res: Response): Promise<void> => {
    const caminho = req.originalUrl.replace(prefixoBff, '');
    const temCorpo = !['GET', 'DELETE', 'HEAD'].includes(req.method);
    try {
      const resp = await fetch(`${baseUrl}${caminho}`, {
        method: req.method,
        headers: temCorpo ? { 'Content-Type': 'application/json' } : undefined,
        body: temCorpo ? JSON.stringify(req.body ?? {}) : undefined,
        signal: AbortSignal.timeout(10000),
      });
      res.status(resp.status);
      res.setHeader('X-Servico-Destino', new URL(baseUrl).host);
      const texto = await resp.text();
      if (!texto) {
        res.end();
        return;
      }
      res.type('application/json').send(texto);
    } catch (e) {
      res.status(502).json({ erro: `Servico indisponivel: ${(e as Error).message}` });
    }
  };
}
