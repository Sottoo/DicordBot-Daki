#!/usr/bin/env bash
# Despliegue automatico: mira si hay commits nuevos en origin/main y, si los
# hay, compila y reinicia el bot. Lo lanza daki-bot-update.timer cada 5 min.
#
# Preguntamos a GitHub desde aqui en vez de que GitHub entre por SSH: asi no
# hay que abrir ningun puerto ni guardar claves del servidor en el repositorio.
#
# Uso interno: --desde <commit> lo pasa el propio script al reejecutarse
# despues de actualizarse a si mismo. No lo llames a mano.
set -euo pipefail

PROYECTO="/home/ubuntu/daki-bot"
cd "$PROYECTO"

# Commit previo al merge, cuando venimos de una reejecucion.
BASE_PREVIA=""
if [ "${1:-}" = "--desde" ] && [ -n "${2:-}" ]; then
    BASE_PREVIA="$2"
fi

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

# Si ya estamos al dia y nadie nos forzo, salimos en silencio para no llenar
# los logs cada 5 minutos.
if [ "$ACTUAL" = "$REMOTO" ] && [ -z "$BASE_PREVIA" ]; then
    exit 0
fi

# Punto de partida real del despliegue: al reejecutarnos, el merge ya se hizo.
BASE="${BASE_PREVIA:-$ACTUAL}"

if [ "$ACTUAL" != "$REMOTO" ]; then
    echo "Cambios detectados: ${ACTUAL:0:7} -> ${REMOTO:0:7}"

    # --ff-only: si alguien hizo commits sueltos en el servidor, preferimos
    # fallar aqui a generar un merge silencioso que nadie revisara.
    git merge --ff-only origin/main

    # Si este mismo archivo venia en los cambios, lo que bash esta ejecutando ya
    # es codigo obsoleto (y ademas lee el script por trozos, asi que seguir
    # leyendo un archivo que cambio bajo sus pies es pedir problemas). Nos
    # reejecutamos con la version nueva pasandole de donde veniamos.
    if ! git diff --quiet "$ACTUAL" "$REMOTO" -- deploy/update.sh; then
        echo "El script de despliegue se actualizo: reejecutando la version nueva."
        exec "$PROYECTO/deploy/update.sh" --desde "$BASE"
    fi
fi

# npm ci solo si cambiaron las dependencias: en 1 GB de RAM es de largo la
# parte mas lenta (recompila canvas) y en la mayoria de despliegues no aporta.
if ! git diff --quiet "$BASE" "$REMOTO" -- package.json package-lock.json; then
    echo "Las dependencias cambiaron: reinstalando..."
    npm ci
fi

# Si la compilacion falla NO reiniciamos: el bot sigue corriendo con la version
# anterior ya cargada en memoria, que es preferible a dejarlo caido. Volvemos el
# repositorio atras para que su estado coincida con lo que se esta ejecutando.
if ! npm run build; then
    echo "BUILD FALLIDO. El bot sigue con la version anterior; revirtiendo a ${BASE:0:7}."
    git reset --hard "$BASE"
    exit 1
fi

echo "Build correcto, reiniciando el bot..."
sudo /usr/bin/systemctl restart daki-bot
echo "Desplegado ${REMOTO:0:7}"
