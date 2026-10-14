#!/bin/sh
set -e

# Sem JWT_SECRET definido (ou com o valor de exemplo do .env.example, que é
# público), gera um aleatório na primeira subida e o reaproveita nas seguintes
# (volume montado em /var/lib/finance-api), para os tokens continuarem
# válidos após reiniciar o container.
if [ "$JWT_SECRET" = "change-me-to-a-random-secret" ]; then
  echo "JWT_SECRET está com o valor de exemplo (público): ignorando."
  JWT_SECRET=""
fi
if [ -z "$JWT_SECRET" ]; then
  SECRET_FILE=/var/lib/finance-api/jwt_secret
  if [ ! -s "$SECRET_FILE" ]; then
    mkdir -p "$(dirname "$SECRET_FILE")"
    (umask 077 && head -c 48 /dev/urandom | base64 | tr -d '\n' > "$SECRET_FILE")
    echo "JWT_SECRET não definido: gerado um segredo aleatório em $SECRET_FILE"
  fi
  JWT_SECRET="$(cat "$SECRET_FILE")"
  export JWT_SECRET
fi

# Aplica as migrations pendentes antes de subir (idempotente).
pnpm exec prisma migrate deploy
exec pnpm start
