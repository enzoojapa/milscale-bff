#!/usr/bin/env bash
# Provisiona a parte Azure do MilScale (executar no Azure Cloud Shell).
#   - Service Bus (fila escala-eventos)
#   - Azure SQL Database
#   - Azure Function (calcular-ciclo + notificar-escala)
#   - Azure Container Apps com as imagens do Docker Hub (efetivo, escala, bff)
#
# Uso:  bash deploy-azure.sh
# As senhas sao pedidas no terminal e nao ficam gravadas em arquivo.
set -euo pipefail

RG=${RG:-rg-milscale}
LOC=${LOC:-eastus2}
SQL_REGIOES=${SQL_REGIOES:-"southcentralus mexicocentral chilecentral northcentralus"}
SUFIXO=${SUFIXO:-enzo}
DH=${DOCKERHUB_USER:-enzowlima}
TAG=${TAG:-v1}

SB=sb-milscale-$SUFIXO
FILA=escala-eventos
ST=stmilscale$SUFIXO
SQLDB=milscale_escala
SQLUSER=milscaleadmin
FUNC=func-milscale-$SUFIXO
ENV=cae-milscale

etapa() { echo; echo "==> $1"; }
existe() { "$@" -o none >/dev/null 2>&1; }

read -rsp "Senha para o admin do Azure SQL (min. 8, letras, numeros e simbolo, sem ; ): " SQL_PASS; echo
read -rsp "Connection string do MongoDB Atlas (mongodb+srv://...): " MONGO_URI; echo

etapa "Grupo de recursos e providers"
az group create -n "$RG" -l "$LOC" -o none
for p in Microsoft.App Microsoft.OperationalInsights Microsoft.ServiceBus Microsoft.Sql Microsoft.Web Microsoft.Storage; do
  az provider register -n "$p" --wait
done
az extension add -n containerapp --upgrade -y -o none 2>/dev/null || true

etapa "Service Bus ($SB / fila $FILA)"
existe az servicebus namespace show -g "$RG" -n "$SB" || az servicebus namespace create -g "$RG" -n "$SB" -l "$LOC" --sku Basic -o none
existe az servicebus queue show -g "$RG" --namespace-name "$SB" -n "$FILA" || az servicebus queue create -g "$RG" --namespace-name "$SB" -n "$FILA" -o none
SB_CONN=$(az servicebus namespace authorization-rule keys list -g "$RG" --namespace-name "$SB" \
  -n RootManageSharedAccessKey --query primaryConnectionString -o tsv 2>/dev/null)

etapa "Azure SQL ($SQLDB)"
# Reaproveita um servidor SQL ja criado no grupo; senao tenta as regioes permitidas.
EXISTENTE=$(az sql server list -g "$RG" --query "[?state=='Ready'].name | [0]" -o tsv 2>/dev/null || true)
if [ -n "$EXISTENTE" ]; then
  SQLSRV=$EXISTENTE
else
  SQLSRV=""
  for regiao in $SQL_REGIOES; do
    nome="sql-milscale-$SUFIXO-$regiao"
    echo "Tentando criar o SQL Server $nome..."
    if az sql server create -g "$RG" -n "$nome" -l "$regiao" -u "$SQLUSER" -p "$SQL_PASS" -o none 2>/tmp/sql.err; then
      SQLSRV=$nome; echo "SQL Server criado em $regiao"; break
    fi
    head -c 300 /tmp/sql.err; echo
  done
  [ -n "$SQLSRV" ] || { echo "Nenhuma regiao aceitou o SQL Server"; exit 1; }
fi
az sql server firewall-rule create -g "$RG" -s "$SQLSRV" -n AllowAzureServices \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none
if existe az sql db show -g "$RG" -s "$SQLSRV" -n "$SQLDB"; then echo "Banco ja existe"
elif ! az sql db create -g "$RG" -s "$SQLSRV" -n "$SQLDB" -e GeneralPurpose -f Gen5 -c 2 \
     --compute-model Serverless --use-free-limit --free-limit-exhaustion-behavior AutoPause -o none; then
  echo "Oferta gratuita indisponivel, criando no plano Basic"
  az sql db create -g "$RG" -s "$SQLSRV" -n "$SQLDB" -e Basic -o none
fi
SQL_CONN="Server=tcp:$SQLSRV.database.windows.net,1433;Database=$SQLDB;User Id=$SQLUSER;Password=$SQL_PASS;Encrypt=true;TrustServerCertificate=false;Connection Timeout=60"

etapa "Azure Function ($FUNC)"
existe az storage account show -g "$RG" -n "$ST" || az storage account create -g "$RG" -n "$ST" -l "$LOC" --sku Standard_LRS -o none
existe az functionapp show -g "$RG" -n "$FUNC" || az functionapp create -g "$RG" -n "$FUNC" -s "$ST" --flexconsumption-location "$LOC" \
  --runtime node --runtime-version 22 -o none
az functionapp config appsettings set -g "$RG" -n "$FUNC" -o none \
  --settings "ServiceBusConnection=$SB_CONN" "SERVICEBUS_QUEUE=$FILA"
rm -rf /tmp/milscale-function
git clone -q https://github.com/enzoojapa/milscale-function /tmp/milscale-function
(cd /tmp/milscale-function && npm ci --silent && npm run build --silent && npm prune --omit=dev --silent \
  && zip -qr /tmp/function.zip dist node_modules host.json package.json)
az functionapp deployment source config-zip -g "$RG" -n "$FUNC" --src /tmp/function.zip -o none
FUNC_URL="https://$(az functionapp show -g "$RG" -n "$FUNC" --query "properties.defaultHostName || hostNames[0]" -o tsv)"

etapa "Container Apps ($ENV)"
existe az containerapp env show -g "$RG" -n "$ENV" || az containerapp env create -g "$RG" -n "$ENV" -l "$LOC" -o none

criar_app() { # nome imagem porta -- argumentos extras
  local nome=$1 imagem=$2 porta=$3; shift 3
  if existe az containerapp show -g "$RG" -n "$nome"; then
    az containerapp delete -g "$RG" -n "$nome" --yes -o none
  fi
  az containerapp create -g "$RG" -n "$nome" --environment "$ENV" \
    --image "docker.io/$DH/$imagem:$TAG" --target-port "$porta" --ingress external \
    --min-replicas 0 --max-replicas 1 --cpu 0.25 --memory 0.5Gi "$@" \
    --query properties.configuration.ingress.fqdn -o tsv
}

EFETIVO_URL="https://$(criar_app ca-milscale-efetivo milscale-efetivo-service 3001 \
  --secrets "mongo-uri=$MONGO_URI" \
  --env-vars MONGO_URI=secretref:mongo-uri MONGO_DB=milscale_efetivo)"

ESCALA_URL="https://$(criar_app ca-milscale-escala milscale-escala-service 3002 \
  --secrets "sql-conn=$SQL_CONN" "sb-conn=$SB_CONN" \
  --env-vars SQL_CONNECTION_STRING=secretref:sql-conn SERVICEBUS_CONNECTION_STRING=secretref:sb-conn SERVICEBUS_QUEUE=$FILA)"

BFF_URL="https://$(criar_app ca-milscale-bff milscale-bff 3000 \
  --env-vars EFETIVO_SERVICE_URL=$EFETIVO_URL ESCALA_SERVICE_URL=$ESCALA_URL FUNCTION_URL=$FUNC_URL NECESSIDADE_DIARIA=4)"

etapa "Pronto"
cat <<EOF
Efetivo service : $EFETIVO_URL/swagger
Escala service  : $ESCALA_URL/swagger
BFF             : $BFF_URL/swagger
Azure Function  : $FUNC_URL/api/ciclo?efetivoApto=24&necessidadeDiaria=4
EOF
