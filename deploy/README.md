# Despliegue en AWS EC2 (Ubuntu)

Pasos para levantar el bot en una instancia propia. Probado sobre
Ubuntu 26.04 LTS, t3.micro (1 GB RAM), disco de 12 GiB.

## 1. Conectarse

Desde PowerShell, con el `.pem` del par de claves:

```powershell
ssh -i "$env:USERPROFILE\.ssh\daki-bot-key.pem" ubuntu@IP_PUBLICA
```

## 2. Sistema al dia

```bash
sudo apt update && sudo apt upgrade -y
```

## 3. Swap de 2 GB (imprescindible en 1 GB de RAM)

El bot corre de sobra con 1 GB, pero `npm install` (compila `canvas` en C++)
y `npm run build` (Vite + tsc) se quedan sin memoria y mueren con un `Killed`
seco. El swap lo evita.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # comprobar que aparece
```

## 4. Dependencias de compilacion de `canvas`

Son las que Railway instalaba con `aptPackages`. Sin ellas fallan `/rank` y la
tarjeta de bienvenida.

```bash
sudo apt install -y build-essential python3 pkg-config \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

## 5. Node.js

Via nvm, para no depender de que los repos de Ubuntu tengan una version
reciente. El enlace en `/usr/local/bin` es el que usa el servicio systemd
(una ruta fija que no cambia al actualizar Node).

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
sudo ln -sf "$(which node)" /usr/local/bin/node
node -v
```

## 6. Codigo y configuracion

```bash
cd ~
git clone https://github.com/Sottoo/DicordBot-Daki.git daki-bot
cd daki-bot
cp .env.example .env
nano .env
```

En el `.env`, ademas de los tokens, **define obligatoriamente**:

```
NODE_ENV=production
DATA_DIR=/home/ubuntu/daki-bot/data
```

Sin `DATA_DIR` el bot intenta escribir en `/app/data` (la ruta del volumen de
Railway, que aqui no existe) y pierde el XP y la config del guardian.

Protege el fichero, que lleva los tokens:

```bash
chmod 600 .env
```

## 7. Instalar y compilar

```bash
npm install
npm run build
```

## 8. Arrancar como servicio

```bash
sudo cp deploy/daki-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now daki-bot
systemctl status daki-bot
```

## 9. Logs

```bash
journalctl -u daki-bot -f        # en vivo
journalctl -u daki-bot -n 100    # ultimas 100 lineas
```

Al arrancar deberia aparecer `✅ Intent MessageContent ACTIVO`. Si sale el
aviso de moderacion desactivada, revisa los intents en el portal de Discord.

## Actualizar el bot

Railway redespleagaba solo al hacer push; aqui es manual:

```bash
cd ~/daki-bot && git pull && npm install && npm run build
sudo systemctl restart daki-bot
```

## Traerse el XP desde Railway

La carpeta `data/` no esta en git. Para no perder los niveles de los usuarios,
descarga `xp.json` y `guardian.json` del volumen de Railway y subelos:

```powershell
scp -i "$env:USERPROFILE\.ssh\daki-bot-key.pem" xp.json ubuntu@IP_PUBLICA:/home/ubuntu/daki-bot/data/
```

Luego `sudo systemctl restart daki-bot`.
