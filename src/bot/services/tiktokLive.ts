import { Client, EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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

export const LIVE_URL = `https://www.tiktok.com/@${USERNAME}/live`;
export const TIKTOK_USERNAME = USERNAME;

// Datos del directo que enriquecen el aviso (portada, título, etc.). Todos son
// opcionales: si TikTok no los devuelve, el embed se construye igualmente.
export interface LiveInfo {
    title?: string;    // Título que el streamer puso al directo.
    coverUrl?: string; // Portada/miniatura del directo (la "captura" que se ve grande).
    avatarUrl?: string; // Avatar del streamer (miniatura arriba a la derecha).
    viewers?: number;  // Espectadores viendo en este momento.
}

// Extrae la primera URL http válida de una imagen de TikTok ({ url_list: [...] }).
function firstImageUrl(image: unknown): string | undefined {
    const list = (image as { url_list?: unknown })?.url_list;
    if (!Array.isArray(list)) return undefined;
    return list.find((u): u is string => typeof u === 'string' && u.startsWith('http'));
}

/**
 * Consulta a TikTok la información del room del streamer y devuelve los datos
 * útiles para el aviso (portada, título, avatar, espectadores). Nunca lanza:
 * ante cualquier fallo (red, rate-limit, formato inesperado) devuelve {} y el
 * aviso se enviará sin imagen.
 */
export async function fetchLiveInfo(): Promise<LiveInfo> {
    try {
        const connection = new TikTokLiveConnection(USERNAME, {});
        const info = await connection.fetchRoomInfo();
        const data = (info?.data ?? {}) as Record<string, any>;

        const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : undefined;
        const viewers = Number.isFinite(data.user_count) && data.user_count > 0 ? Number(data.user_count) : undefined;

        return {
            title,
            coverUrl: firstImageUrl(data.cover),
            avatarUrl: firstImageUrl(data.owner?.avatar_large) ?? firstImageUrl(data.owner?.avatar_thumb),
            viewers,
        };
    } catch (error) {
        console.warn(`[TIKTOK] No se pudo obtener la portada/info del directo de @${USERNAME}:`, (error as Error)?.message ?? error);
        return {};
    }
}

// Construye el embed del aviso de directo. Se reutiliza tanto en el aviso real
// como en el comando de prueba /testdirecto. Si se le pasa `info`, enriquece el
// aviso con la portada del directo, su título y los espectadores actuales.
export function buildLiveEmbed(info: LiveInfo = {}): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor('#FE2C55') // Rojo/rosa de TikTok
        .setTitle('🔴 ¡Daki está EN DIRECTO!')
        .setURL(LIVE_URL);

    // Línea de autor: canal + plataforma juntos, con el avatar del streamer.
    // Así evitamos campos sueltos de "Plataforma" y "Canal".
    embed.setAuthor({
        name: `@${USERNAME} · TikTok LIVE`,
        url: LIVE_URL,
        ...(info.avatarUrl ? { iconURL: info.avatarUrl } : {}),
    });

    // Descripción compacta: el título real del directo como cita (si lo hay) y
    // una sola llamada a la acción. El botón "Ver directo" ya invita a entrar.
    const lineas: string[] = [];
    if (info.title) lineas.push(`> *${info.title.slice(0, 200)}*`);
    lineas.push('¡Éntrale ahora antes de que se llene el directo! 🔥');
    embed.setDescription(lineas.join('\n\n'));

    // Único dato numérico, y solo si aporta (evitamos "0 espectadores").
    if (info.viewers) {
        embed.addFields({ name: '👀 Viendo ahora', value: info.viewers.toLocaleString('es-MX'), inline: true });
    }

    // Portada del directo como imagen grande: la "captura" del stream, protagonista.
    if (info.coverUrl) embed.setImage(info.coverUrl);

    return embed
        .setFooter({ text: 'Daki Bot · Avisos de directo' })
        .setTimestamp();
}

// Botón clicable "Ver directo" que lleva al stream de TikTok.
export function buildLiveComponents(): ActionRowBuilder<ButtonBuilder>[] {
    const boton = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Ver directo ahora')
        .setEmoji('🔴')
        .setURL(LIVE_URL);

    return [new ActionRowBuilder<ButtonBuilder>().addComponents(boton)];
}

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

        // Intentamos enriquecer el aviso con la portada/título del directo. Si
        // falla, fetchLiveInfo() devuelve {} y el aviso sale igual (sin imagen).
        const info = await fetchLiveInfo();

        await (channel as TextChannel).send({
            content: MENTION ? `${MENTION} 🔴 **¡Daki está en directo en TikTok!**` : undefined,
            embeds: [buildLiveEmbed(info)],
            components: buildLiveComponents(),
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
