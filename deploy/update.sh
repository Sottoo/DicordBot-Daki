#!/usr/bin/env bash
# Despliegue automatico: mira si hay commits nuevos en origin/main y, si los
# hay, compila y reinicia el bot. Lo lanza daki-bot-update.timer cada 5 min.
#
# Preguntamos a GitHub desde aqui en vez de que GitHub entre por SSH: asi no
# hay que abrir ningun puerto ni guardar claves del servidor en el repositorio.
set -euo pipefail

PROYECTO="/home/ubuntu/daki-bot"
cd "$PROYECTO"

git fetch --quiet origin main

ACTUAL=$(git rev-parse HEAD)
REMOTO=$(git rev-parse origin/main)

if [ "$ACTUAL" = "$REMOTO" ]; then
    exit 0   # nada nuevo, salimos en silencio para no llenar los logs
fi

echo "Cambios detectados: ${ACTUAL:0:7} -> ${REMOTO:0:7}"

# npm ci solo si cambiaron las dependencias: en 1 GB de RAM es de largo la
# parte mas lenta (recompila canvas) y en la mayoria de despliegues no aporta.
NECESITA_INSTALL=0
if ! git diff --quiet "$ACTUAL" "$REMOTO" -- package.json package-lock.json; then
    NECESITA_INSTALL=1
fi

# --ff-only: si alguien hizo commits sueltos en el servidor, preferimos fallar
# aqui a generar un merge silencioso que nadie revisara.
git merge --ff-only origin/main

if [ "$NECESITA_INSTALL" = "1" ]; then
    echo "Las dependencias cambiaron: reinstalando..."
    npm ci
fi

# Si la compilacion falla NO reiniciamos: el bot sigue corriendo con la version
# anterior ya cargada en memoria, que es preferible a dejarlo caido. Volvemos el
# repositorio atras para que su estado coincida con lo que se esta ejecutando.
if ! npm run build; then
    echo "BUILD FALLIDO. El bot sigue con la version anterior; revirtiendo el repositorio."
    git reset --hard "$ACTUAL"
    exit 1
fi

echo "Build correcto, reiniciando el bot..."
sudo /usr/bin/systemctl restart daki-bot
echo "Desplegado ${REMOTO:0:7}"
