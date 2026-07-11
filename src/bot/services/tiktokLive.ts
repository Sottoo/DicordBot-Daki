import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { TikTokLiveConnection } from 'tiktok-live-connector';

// --- Configuración (con valores por defecto, sobreescribibles por variables de entorno) ---
const USERNAME = (process.env.TIKTOK_USERNAME || 'daki0542').replace(/^@/, '');
const CHANNEL_ID = process.env.TIKTOK_ANNOUNCE_CHANNEL_ID || '1505781686271737956';
const MENTION = process.env.TIKTOK_MENTION ?? '@everyone'; // pon '' para no mencionar a nadie

// Intervalo de sondeo. Mínimo 60s para no exponernos a bloqueos de TikTok.
const POLL_INTERVAL_MS = Math.max(60_000, Number(process.env.TIKTOK_POLL_INTERVAL_MS) || 180_000);

// Tiempo mínimo entre dos avisos, para que un parpadeo de la conexión no
// genere un segundo aviso del mismo directo.
const MIN_ANNOUNCE_GAP_MS = 30 * 60 * 1000; // 30 minutos

const LIVE_URL = `https://www.tiktok.com/@${USERNAME}/live`;

let wasLive = false;
let lastAnnouncedAt = 0;
let started = false;

async function checkOnce(client: Client, connection: TikTokLiveConnection): Promise<void> {
    let isLive: boolean;
    try {
        isLive = await connection.fetchIsLive();
    } catch (error) {
        // La API no es oficial: fallos de red / rate-limit son esperables.
        // No cambiamos el estado y reintentamos en el siguiente ciclo.
        console.warn(`[TIKTOK] No se pudo comprobar el estado de @${USERNAME}:`, (error as Error)?.message ?? error);
        return;
    }

    // Solo nos interesa la transición offline -> live.
    if (isLive && !wasLive) {
        const now = Date.now();
        if (now - lastAnnouncedAt < MIN_ANNOUNCE_GAP_MS) {
            wasLive = true; // marcamos, pero no volvemos a avisar tan pronto
            return;
        }
        lastAnnouncedAt = now;
        await announce(client);
    }

    wasLive = isLive;
}

async function announce(client: Client): Promise<void> {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased() || !('send' in channel)) {
            console.warn(`[TIKTOK] El canal de avisos ${CHANNEL_ID} no existe o no es de texto.`);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#FE2C55') // Rojo/rosa de TikTok
            .setTitle('🔴 ¡Daki está EN DIRECTO en TikTok!')
            .setDescription(`**Daki** acaba de empezar un directo. ¡Éntrale antes de que se llene! 👇\n\n${LIVE_URL}`)
            .setFooter({ text: 'Aviso de directo · Daki Bot' })
            .setTimestamp();

        await (channel as TextChannel).send({
            content: MENTION ? `${MENTION} 🎥` : undefined,
            embeds: [embed],
            // Nos aseguramos de que @everyone haga ping (requiere permiso "Mencionar a todos").
            allowedMentions: { parse: MENTION === '@everyone' ? ['everyone'] : MENTION.startsWith('<@&') ? ['roles'] : [] },
        });

        console.log(`[TIKTOK] Aviso de directo enviado (@${USERNAME}).`);
    } catch (error) {
        console.error('[TIKTOK] Error enviando el aviso de directo:', error);
    }
}

/**
 * Arranca el vigía de directos de TikTok. Sondea cada POLL_INTERVAL_MS si el
 * streamer está en vivo y, en la transición offline->live, avisa en el canal.
 */
export function startTikTokWatcher(client: Client): void {
    if (started) return; // idempotente
    started = true;

    if (process.env.TIKTOK_ENABLED === 'false') {
        console.log('[TIKTOK] Vigía de directos desactivado (TIKTOK_ENABLED=false).');
        return;
    }

    const connection = new TikTokLiveConnection(USERNAME, {});

    console.log(`[TIKTOK] Vigilando directos de @${USERNAME} cada ${Math.round(POLL_INTERVAL_MS / 1000)}s → canal ${CHANNEL_ID}.`);

    // Sondeo inicial "silencioso": si ya está en directo al arrancar el bot
    // (p. ej. tras un redeploy), NO avisamos; solo sembramos el estado para
    // detectar el próximo inicio real de directo.
    connection.fetchIsLive()
        .then(live => {
            wasLive = live;
            if (live) console.log(`[TIKTOK] @${USERNAME} ya estaba en directo al arrancar; no se reenvía aviso.`);
        })
        .catch(() => { /* se resolverá en el primer ciclo */ });

    setInterval(() => {
        void checkOnce(client, connection);
    }, POLL_INTERVAL_MS);
}
