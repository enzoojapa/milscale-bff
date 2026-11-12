# MilScale - BFF

Esse é o BFF (Backend for Frontend) do MilScale, o sistema que a gente fez pra montar a escala de serviço de 24h de uma organização militar, que hoje é feita em planilha. O frontend nunca fala direto com os microsserviços, tudo passa por aqui, e na frente do BFF fica o API Gateway da AWS.

A rota principal é o `GET /aggregated-data`. Ela busca o efetivo no microsserviço do MongoDB e a escala do dia no microsserviço do Azure SQL ao mesmo tempo, depois manda a quantidade de militares aptos pra Azure Function calcular o ciclo de serviço, e devolve tudo junto em um JSON só. Cada parte da resposta tem o seu próprio status, então se um serviço cair o painel continua mostrando o resto em vez de dar erro na tela inteira. Além disso o BFF faz o proxy do CRUD: o que chega em `/api/militares` vai pro serviço de efetivo e o que chega em `/api/escalas`, `/api/trocas` e `/api/eventos` vai pro serviço de escalas.

O código segue Clean Architecture com Vertical Slice. Em `src/domain` ficam os modelos do painel, em `src/application` o caso de uso de agregação e as interfaces dos clientes, em `src/infrastructure` os clientes HTTP e o proxy, e em `src/api` as rotas, o Swagger e a montagem das dependências. Os testes unitários cobrem a agregação, a falha parcial e o proxy, e os testes de arquitetura garantem que uma camada não importa a outra no sentido errado e que o BFF não acessa banco nenhum direto.

Foi feito em Node.js 22 com TypeScript e Express 5, com Swagger UI pra documentação, Jest e Supertest nos testes e Docker pra imagem.

Pra rodar na máquina é só instalar as dependências, copiar o `.env.example` pra `.env` com as URLs dos serviços e da Function e subir:

```bash
npm install
cp .env.example .env
npm run dev
npm test
```

A imagem está no Docker Hub e foi gerada com:

```bash
docker build -t enzowlima/milscale-bff:v1 .
docker push enzowlima/milscale-bff:v1
```

Na nuvem o BFF roda no Azure Container Apps. O Swagger fica em https://ca-milscale-bff.ashyforest-fcfffbba.eastus2.azurecontainerapps.io/swagger, o endpoint agregado pelo gateway em https://2r51s1kurb.execute-api.us-east-1.amazonaws.com/aggregated-data e a imagem em https://hub.docker.com/r/enzowlima/milscale-bff.

Os outros repositórios do projeto são o frontend (https://github.com/enzoojapa/milscale-frontend), o serviço de efetivo (https://github.com/enzoojapa/milscale-efetivo-service), o serviço de escalas (https://github.com/enzoojapa/milscale-escala-service) e a Function (https://github.com/enzoojapa/milscale-function).

Trabalho feito por Enzo Watanabe de Lima, João Guilherme Salomão, João Guilherme Cordeiro e Rafael Zeni Simião, para a disciplina de Arquitetura e Soluções Cloud da PUCPR (2026/2).
