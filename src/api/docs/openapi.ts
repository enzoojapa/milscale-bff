const json = (schema: object) => ({ content: { 'application/json': { schema } } });
const erro = { type: 'object', properties: { erro: { type: 'string' } } };
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const POSTOS = ['SENTINELA', 'CABO_DA_GUARDA', 'SARGENTO_DE_DIA', 'OFICIAL_DE_DIA'];

const bloco = (dados: object) => ({
  type: 'object',
  properties: { status: { type: 'string', enum: ['ok', 'erro'] }, dados, erro: { type: 'string' } },
});

const militarInput = {
  type: 'object',
  properties: {
    nomeGuerra: { type: 'string', example: 'SILVA' },
    nomeCompleto: { type: 'string', example: 'Joao Pedro da Silva' },
    graduacao: { type: 'string', enum: ['SOLDADO', 'CABO', 'SARGENTO', 'TENENTE', 'CAPITAO'], example: 'SOLDADO' },
    subunidade: { type: 'string', example: '1a Companhia' },
    situacao: { type: 'string', enum: ['APTO', 'MISSAO', 'AFASTADO'], example: 'APTO' },
  },
};

const escalaInput = {
  type: 'object',
  properties: {
    data: { type: 'string', format: 'date', example: '2026-11-20' },
    militarId: { type: 'string' },
    militarNome: { type: 'string', example: 'SD SILVA' },
    posto: { type: 'string', enum: POSTOS, example: 'SENTINELA' },
  },
};

const eventoSchema = {
  type: 'object',
  properties: {
    tipo: { type: 'string', enum: ['EscalaPublicada', 'TrocaAprovada'] },
    versao: { type: 'integer' },
    ocorridoEm: { type: 'string', format: 'date-time' },
    dados: { type: 'object' },
  },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'MilScale - BFF',
    version: '1.0.0',
    description:
      'Backend for Frontend do MilScale. Unica porta de entrada do frontend (atras do API Gateway). ' +
      'Agrega o microsservico de efetivo (MongoDB), o de escalas (Azure SQL) e a Azure Function, e repassa o CRUD.',
  },
  tags: [
    { name: 'Agregacao', description: 'Endpoint obrigatorio do projeto' },
    { name: 'Militares', description: 'Proxy para milscale-efetivo-service (MongoDB)' },
    { name: 'Escalas', description: 'Proxy para milscale-escala-service (Azure SQL)' },
    { name: 'Trocas', description: 'Proxy para milscale-escala-service (Azure SQL)' },
    { name: 'Eventos', description: 'Eventos EscalaPublicada e TrocaAprovada (Azure Service Bus)' },
    { name: 'Function', description: 'Proxy para a Azure Function (HTTP Trigger)' },
  ],
  paths: {
    '/aggregated-data': {
      get: {
        tags: ['Agregacao'],
        summary: 'Painel do dia: efetivo (Mongo) + escala (SQL) + ciclo (Function) em um unico JSON',
        parameters: [
          { name: 'data', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Padrao: hoje (Brasilia)' },
          { name: 'necessidadeDiaria', in: 'query', schema: { type: 'integer', default: 4 } },
        ],
        responses: {
          200: {
            description: 'Dados agregados. Cada bloco informa se a fonte respondeu.',
            ...json({
              type: 'object',
              properties: {
                data: { type: 'string', format: 'date' },
                geradoEm: { type: 'string', format: 'date-time' },
                tempoMs: { type: 'integer' },
                efetivo: bloco({ type: 'object', properties: { total: { type: 'integer' }, aptos: { type: 'integer' }, militares: { type: 'array', items: { type: 'object' } } } }),
                escala: bloco({ type: 'object', properties: { total: { type: 'integer' }, escalas: { type: 'array', items: { type: 'object' } } } }),
                ciclo: bloco({ type: 'object', properties: { cicloDias: { type: 'integer' }, folgaEntreServicosDias: { type: 'integer' } } }),
              },
            }),
          },
          400: { description: 'Parametro invalido', ...json(erro) },
        },
      },
    },
    '/api/militares': {
      get: { tags: ['Militares'], summary: 'Lista militares', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Militares'], summary: 'Cadastra militar', requestBody: { required: true, ...json(militarInput) }, responses: { 201: { description: 'Criado' }, 400: { description: 'Invalido', ...json(erro) }, 409: { description: 'Duplicado', ...json(erro) } } },
    },
    '/api/militares/{id}': {
      get: { tags: ['Militares'], summary: 'Busca militar', parameters: [idParam], responses: { 200: { description: 'OK' }, 404: { description: 'Nao encontrado' } } },
      put: { tags: ['Militares'], summary: 'Atualiza militar', parameters: [idParam], requestBody: { required: true, ...json(militarInput) }, responses: { 200: { description: 'OK' } } },
      delete: { tags: ['Militares'], summary: 'Remove militar', parameters: [idParam], responses: { 204: { description: 'Removido' } } },
    },
    '/api/escalas': {
      get: { tags: ['Escalas'], summary: 'Lista escalas', parameters: [{ name: 'data', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { 200: { description: 'OK' } } },
      post: { tags: ['Escalas'], summary: 'Cria escala', requestBody: { required: true, ...json(escalaInput) }, responses: { 201: { description: 'Criada' }, 409: { description: 'Militar ja escalado no dia' } } },
    },
    '/api/escalas/{id}': {
      get: { tags: ['Escalas'], summary: 'Busca escala', parameters: [idParam], responses: { 200: { description: 'OK' } } },
      put: { tags: ['Escalas'], summary: 'Altera escala em rascunho', parameters: [idParam], requestBody: { required: true, ...json(escalaInput) }, responses: { 200: { description: 'OK' }, 422: { description: 'Escala publicada' } } },
      delete: { tags: ['Escalas'], summary: 'Remove escala em rascunho', parameters: [idParam], responses: { 204: { description: 'Removida' } } },
    },
    '/api/escalas/{id}/publicar': {
      post: { tags: ['Escalas', 'Eventos'], summary: 'Publica escala e emite EscalaPublicada', parameters: [idParam], responses: { 200: { description: 'Publicada' } } },
    },
    '/api/trocas': {
      get: { tags: ['Trocas'], summary: 'Lista trocas', responses: { 200: { description: 'OK' } } },
      post: {
        tags: ['Trocas'],
        summary: 'Solicita troca (regra: 24h de antecedencia)',
        requestBody: { required: true, ...json({ type: 'object', properties: { escalaId: { type: 'integer' }, militarSubstitutoId: { type: 'string' }, militarSubstitutoNome: { type: 'string' }, motivo: { type: 'string' } } }) },
        responses: { 201: { description: 'Solicitada' }, 422: { description: 'Menos de 24h de antecedencia', ...json(erro) } },
      },
    },
    '/api/trocas/{id}/aprovar': {
      post: { tags: ['Trocas', 'Eventos'], summary: 'Aprova troca e emite TrocaAprovada', parameters: [idParam], responses: { 200: { description: 'Aprovada' } } },
    },
    '/api/eventos': {
      get: { tags: ['Eventos'], summary: 'Ultimos eventos publicados', responses: { 200: { description: 'OK', ...json({ type: 'object', properties: { total: { type: 'integer' }, eventos: { type: 'array', items: eventoSchema } } }) } } },
    },
    '/api/ciclo': {
      get: {
        tags: ['Function'],
        summary: 'Calcula o ciclo de servico (Azure Function HTTP Trigger)',
        parameters: [
          { name: 'efetivoApto', in: 'query', required: true, schema: { type: 'integer', example: 24 } },
          { name: 'necessidadeDiaria', in: 'query', required: true, schema: { type: 'integer', example: 4 } },
        ],
        responses: { 200: { description: 'OK' }, 400: { description: 'Entrada invalida', ...json(erro) } },
      },
    },
  },
  components: { schemas: { Evento: eventoSchema } },
};
