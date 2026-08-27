#!/usr/bin/env bash
# Despliegue automatico: mira si hay commits nuevos en origin/main y, si los
# hay, compila y reinicia el bot. Lo lanza daki-bot-update.timer cada 5 min.
#
# Preguntamos a GitHub desde aqui en vez de que GitHub entre por SSH: asi no
# hay que abrir ningun puerto ni guardar claves del servidor en el repositorio.
set -euo pipefail

PROYECTO="/home/ubuntu/daki-bot"
cd "$PROYECTO"

# systemd NO carga ~/.bashrc, que es donde nvm mete Node en el PATH. Sin esto,
# el script falla con "npm: command not found" en cada despliegue. Deducimos la
# ruta del enlace /usr/local/bin/node que ya usa el servicio del bot, para no
# tener que codificar aqui la version de Node.
if ! command -v npm >/dev/null 2>&1; then
    if [ -L /usr/local/bin/node ]; then
        PATH="$(dirname "$(readlink -f /usr/local/bin/node)"):$PATH"
        export PATH
    elif [ -s "$HOME/.nvm/nvm.sh" ]; then
        # shellcheck source=/dev/null
        . "$HOME/.nvm/nvm.sh"
    fi
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "No encuentro npm. Comprueba que /usr/local/bin/node sea un enlace al node de nvm:"
    echo "  sudo ln -sf \"\$(which node)\" /usr/local/bin/node"
    exit 1
fi

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
