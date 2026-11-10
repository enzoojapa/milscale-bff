# MilScale - BFF (Backend for Frontend)

Backend for Frontend em Node.js. É a única porta de entrada do frontend (atrás do API Gateway): o frontend nunca chama os microsserviços diretamente.

Responsabilidades:

- **Agregação**: `GET /aggregated-data` consulta o microsserviço de efetivo (MongoDB), o de escalas (Azure SQL) e a Azure Function, e devolve tudo em um único JSON.
- **Proxy do CRUD**: `/api/militares`, `/api/escalas`, `/api/trocas`, `/api/eventos` e `/api/ciclo` são repassados ao serviço correspondente.

## GET /aggregated-data

1. Busca o efetivo e a escala do dia em paralelo.
2. Com o número de aptos, chama a Function para calcular o ciclo.
3. Responde com os blocos `efetivo`, `escala` e `ciclo`. Cada bloco informa se a fonte respondeu, então uma falha parcial não derruba a tela.

```json
{
  "data": "2026-11-20",
  "tempoMs": 412,
  "efetivo": { "status": "ok", "dados": { "total": 12, "aptos": 10, "militares": [] } },
  "escala":  { "status": "ok", "dados": { "total": 4, "escalas": [] } },
  "ciclo":   { "status": "ok", "dados": { "cicloDias": 2, "folgaEntreServicosDias": 1 } }
}
```

## Arquitetura

```
Usuário -> Microfrontend (React) -> API Gateway (AWS) -> BFF (Node.js)
                                                         |-> Efetivo Service -> MongoDB Atlas
                                                         |-> Escala Service  -> Azure SQL
                                                         |                   -> Azure Service Bus -> Function (notificar-escala)
                                                         |-> Azure Function (calcular-ciclo)
```

```
src/
  domain/            modelos do painel
  application/       get-aggregated-data e portas dos gateways
  infrastructure/    clientes HTTP dos serviços e proxy
  api/               rotas, Swagger e composição
tests/
  unit/              agregação, falha parcial e proxy
  architecture/      camadas, slices e proibição de acesso direto a banco
```

## Tecnologias

Node.js 22, TypeScript, Express 5, Fetch API, Swagger UI, Jest, Supertest, Docker.

## Como rodar localmente

```bash
npm install
cp .env.example .env   # URLs dos serviços e da Function
npm run dev            # http://localhost:3000/swagger
npm test
```

```bash
docker build -t enzoojapa/milscale-bff:v1 .
docker run -p 3000:3000 -e EFETIVO_SERVICE_URL=... -e ESCALA_SERVICE_URL=... -e FUNCTION_URL=... enzoojapa/milscale-bff:v1
```

## Links

- Swagger: _LINK_SWAGGER_
- API Gateway: _LINK_GATEWAY_
- Docker Hub: _LINK_DOCKER_

## Projetos do sistema

| Componente | Repositório |
|---|---|
| Microfrontend (React) | [milscale-frontend](https://github.com/enzoojapa/milscale-frontend) |
| BFF (Node.js) | [milscale-bff](https://github.com/enzoojapa/milscale-bff) |
| Microsserviço de efetivo (MongoDB) | [milscale-efetivo-service](https://github.com/enzoojapa/milscale-efetivo-service) |
| Microsserviço de escalas (Azure SQL) | [milscale-escala-service](https://github.com/enzoojapa/milscale-escala-service) |
| Azure Function | [milscale-function](https://github.com/enzoojapa/milscale-function) |

## Alunos

- Enzo Watanabe de Lima
- João Guilherme Salomão
- João Guilherme Cordeiro
- Rafael Zeni Simião

PUCPR - Engenharia de Software - Arquitetura e Soluções Cloud (2026/2)
