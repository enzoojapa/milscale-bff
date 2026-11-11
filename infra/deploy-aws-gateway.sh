#!/usr/bin/env bash
# Cria o API Gateway (HTTP API) na AWS na frente do BFF. Executar no AWS CloudShell.
# Uso: BFF_URL=https://<bff>.azurecontainerapps.io bash deploy-aws-gateway.sh
set -euo pipefail

BFF_URL=${BFF_URL:?Informe BFF_URL}
NOME=${NOME:-milscale-gateway}
REGIAO=${AWS_REGION:-us-east-1}

API_ID=$(aws apigatewayv2 get-apis --region "$REGIAO" --query "Items[?Name=='$NOME'].ApiId | [0]" --output text)
if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  API_ID=$(aws apigatewayv2 create-api --region "$REGIAO" --name "$NOME" --protocol-type HTTP \
    --cors-configuration 'AllowOrigins=*,AllowMethods=GET,POST,PUT,DELETE,OPTIONS,AllowHeaders=content-type' \
    --query ApiId --output text)
fi

# Integracao HTTP proxy: /{proxy} e repassado para o BFF mantendo o caminho
INTEG_ID=$(aws apigatewayv2 create-integration --region "$REGIAO" --api-id "$API_ID" \
  --integration-type HTTP_PROXY --integration-method ANY \
  --integration-uri "$BFF_URL/{proxy}" --payload-format-version 1.0 \
  --query IntegrationId --output text)

for rota in 'ANY /{proxy+}'; do
  EXISTE=$(aws apigatewayv2 get-routes --region "$REGIAO" --api-id "$API_ID" --query "Items[?RouteKey=='$rota'].RouteId | [0]" --output text)
  if [ "$EXISTE" = "None" ]; then
    aws apigatewayv2 create-route --region "$REGIAO" --api-id "$API_ID" --route-key "$rota" --target "integrations/$INTEG_ID" >/dev/null
  else
    aws apigatewayv2 update-route --region "$REGIAO" --api-id "$API_ID" --route-id "$EXISTE" --target "integrations/$INTEG_ID" >/dev/null
  fi
done

# Stage padrao com deploy automatico e limite de requisicoes
if ! aws apigatewayv2 get-stage --region "$REGIAO" --api-id "$API_ID" --stage-name '$default' >/dev/null 2>&1; then
  aws apigatewayv2 create-stage --region "$REGIAO" --api-id "$API_ID" --stage-name '$default' --auto-deploy >/dev/null
fi
aws apigatewayv2 update-stage --region "$REGIAO" --api-id "$API_ID" --stage-name '$default' \
  --default-route-settings ThrottlingBurstLimit=20,ThrottlingRateLimit=10 >/dev/null

ENDPOINT=$(aws apigatewayv2 get-api --region "$REGIAO" --api-id "$API_ID" --query ApiEndpoint --output text)
echo "API Gateway: $ENDPOINT"
echo "Teste:       $ENDPOINT/aggregated-data"
