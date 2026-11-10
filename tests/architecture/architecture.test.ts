import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivos(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function imports(arquivo: string): string[] {
  const conteudo = fs.readFileSync(arquivo, 'utf8');
  return [...conteudo.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

function camadaDoImport(arquivo: string, imp: string): string | null {
  if (!imp.startsWith('.')) return null;
  const alvo = path.relative(SRC, path.resolve(path.dirname(arquivo), imp));
  return alvo.split(path.sep)[0];
}

function violacoes(camada: string, proibidas: string[]): string[] {
  return arquivos(path.join(SRC, camada)).flatMap((f) =>
    imports(f)
      .filter((i) => proibidas.includes(camadaDoImport(f, i) ?? ''))
      .map((i) => `${path.relative(SRC, f)} -> ${i}`),
  );
}

describe('Clean Architecture', () => {
  it('domain nao depende de nenhuma outra camada', () => {
    expect(violacoes('domain', ['application', 'infrastructure', 'api'])).toEqual([]);
  });

  it('domain nao usa bibliotecas externas', () => {
    const externos = arquivos(path.join(SRC, 'domain')).flatMap((f) => imports(f).filter((i) => !i.startsWith('.')));
    expect(externos).toEqual([]);
  });

  it('application nao depende de infrastructure nem de api', () => {
    expect(violacoes('application', ['infrastructure', 'api'])).toEqual([]);
  });

  it('infrastructure nao depende de api', () => {
    expect(violacoes('infrastructure', ['api'])).toEqual([]);
  });
});

describe('Vertical Slice', () => {
  it('uma feature da application nao importa outra feature', () => {
    const appDir = path.join(SRC, 'application');
    const features = fs.readdirSync(appDir).filter((d) => fs.statSync(path.join(appDir, d)).isDirectory());
    const erros = features.flatMap((feature) =>
      arquivos(path.join(appDir, feature)).flatMap((f) =>
        imports(f)
          .filter((i) => i.startsWith('.'))
          .map((i) => path.relative(appDir, path.resolve(path.dirname(f), i)).split(path.sep)[0])
          .filter((alvo) => features.includes(alvo) && alvo !== feature)
          .map((alvo) => `${feature} -> ${alvo}`),
      ),
    );
    expect(erros).toEqual([]);
  });

  it('cada feature tem sua rota na camada api', () => {
    const appDir = path.join(SRC, 'application');
    const features = fs.readdirSync(appDir).filter((d) => fs.statSync(path.join(appDir, d)).isDirectory());
    const rotas = fs.readdirSync(path.join(SRC, 'api/features'));
    features.forEach((feature) => expect(rotas).toContain(`${feature}.route.ts`));
  });
});

describe('Regras do BFF', () => {
  it('BFF nao acessa banco de dados diretamente', () => {
    const drivers = ['mongodb', 'mssql', 'mongoose', 'pg', 'mysql2', 'typeorm', 'prisma'];
    const usos = arquivos(SRC).flatMap((f) => imports(f).filter((i) => drivers.includes(i)).map((i) => `${path.relative(SRC, f)} -> ${i}`));
    expect(usos).toEqual([]);
  });

  it('application conversa com os servicos apenas por portas (sem fetch)', () => {
    const usos = arquivos(path.join(SRC, 'application')).filter((f) => /\bfetch\(/.test(fs.readFileSync(f, 'utf8')));
    expect(usos).toEqual([]);
  });
});
