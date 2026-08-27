import {
    ChannelType,
    EmbedBuilder,
    Guild,
    GuildBasedChannel,
    GuildMember,
    Message,
    PermissionFlagsBits,
    TextChannel,
} from 'discord.js';
import { getConfig, setConfig } from '../utils/guardConfig.js';
import { registrar, avisarPropietario, etiquetaUsuario } from '../utils/modLog.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. NORMALIZACIÓN DE TEXTO
// El ataque típico no escribe "https://dlscord.gift" en limpio: mete caracteres
// invisibles, "discord[.]gg", "hxxp://" o acentos falsos para esquivar regex.
// ─────────────────────────────────────────────────────────────────────────────

/** Codepoints invisibles que los atacantes insertan dentro de los enlaces. */
const INVISIBLES = new Set([
    0x200b, 0x200c, 0x200d, 0x200e, 0x200f,
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
    0x2060, 0xfeff, 0x00ad, 0x034f, 0x180e,
]);

/** Limpieza básica: minúsculas, sin caracteres invisibles ni homoglifos. */
function normalizarPlano(texto: string): string {
    let limpio = '';
    // Quitamos caracteres invisibles (ancho cero, control bidireccional) que se
    // usan para partir palabras y esquivar los filtros: d​iscord.gg
    for (const ch of texto) {
        if (!INVISIBLES.has(ch.codePointAt(0)!)) limpio += ch;
    }
    return limpio
        .toLowerCase()
        .replace(/[à-åā]/g, 'a')
        .replace(/[è-ëē]/g, 'e')
        .replace(/[ì-ïī]/g, 'i')
        .replace(/[ò-öō]/g, 'o')
        .replace(/[ù-üū]/g, 'u')
        .replace(/[çć]/g, 'c')
        // Alfabeto de ancho completo usado para imitar letras latinas.
        .replace(/[ａ-ｚ]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xFEE0));
}

/**
 * Limpieza agresiva: además reconstruye los puntos escondidos
 * ("discord [.] gg", "discord punto gg", "hxxp://").
 * Se usa SOLO para buscar marcas concretas (invites, dominios de estafa),
 * donde un falso positivo es casi imposible.
 */
function normalizarAgresivo(plano: string): string {
    return plano
        .replace(/\s*[\[\(\{<]\s*\.\s*[\]\)\}>]\s*/g, '.')
        .replace(/\s+(?:dot|punto)\s+/g, '.')
        .replace(/\s*[·•]\s*/g, '.')
        .replace(/h[x*#]{2}ps?:\/\//g, 'http://')
        .replace(/\s*\.\s*/g, '.')
        .replace(/\s*\/\s*/g, '/');
}

/** Reúne TODO el texto del mensaje, no solo message.content. */
function extraerTexto(message: Message): string {
    const partes: string[] = [message.content ?? ''];

    for (const e of message.embeds) {
        partes.push(e.title ?? '', e.description ?? '', e.url ?? '', e.author?.name ?? '', e.author?.url ?? '', e.footer?.text ?? '');
        for (const f of e.fields ?? []) partes.push(f.name, f.value);
    }
    for (const a of message.attachments.values()) partes.push(a.name ?? '', a.description ?? '');
    for (const s of message.stickers.values()) partes.push(s.name ?? '');

    // Mensajes reenviados (forwards): el contenido vive en el snapshot, no en content.
    const snapshots = (message as any).messageSnapshots;
    if (snapshots?.values) {
        for (const snap of snapshots.values()) {
            const m = snap?.message ?? snap;
            partes.push(m?.content ?? '');
            for (const e of m?.embeds ?? []) partes.push(e.title ?? '', e.description ?? '', e.url ?? '');
        }
    }

    return partes.filter(Boolean).join(' \n ');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LISTAS Y PATRONES
// ─────────────────────────────────────────────────────────────────────────────

/** Dominios siempre permitidos (GIFs, CDN de Discord, redes del propio Daki). */
const DOMINIOS_BASE_PERMITIDOS = [
    'tenor.com', 'giphy.com', 'media.tenor.com',
    'cdn.discordapp.com', 'media.discordapp.net', 'images-ext-1.discordapp.net', 'images-ext-2.discordapp.net',
    'tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com',
    'youtube.com/watch', 'youtu.be', 'm.youtube.com/watch',
    'open.spotify.com',
];

/** Invitaciones a otros servidores de Discord. */
const RE_INVITE = /(?:discord|discordapp)\.(?:gg|com\/invite|me)\/[a-z0-9_-]{2,}|(?:dsc|invite|discord)\.gg\/[a-z0-9_-]{2,}/i;

/** Dominios de phishing, imitaciones de marca, acortadores y grabbers de IP. */
const DOMINIOS_ESTAFA = [
    // Imitaciones de Discord
    'dlscord.', 'discrod.', 'disc0rd.', 'discorcl.', 'dilscord.', 'discord-nitro', 'discordnitro',
    'discordgift', 'discord-gift', 'discrod-gift', 'dlscordgift', 'discordapp.io', 'discordc.gift',
    'discord.gift/', 'nitro-drop', 'freenitro', 'nitrogift', 'nitro-claim',
    // Imitaciones de Steam / juegos
    'steamcommunity.ru', 'steancommunity', 'steamcomunity', 'stearncommunity', 'steamcommunytt',
    'roblox-free', 'robux-free', 'free-robux',
    // Acortadores (esconden el destino real)
    'bit.ly/', 'tinyurl.com/', 'cutt.ly/', 'shorturl.', 'rb.gy/', 'is.gd/', 't.ly/', 'shorte.st',
    'adf.ly/', 'ouo.io/', 'linkvertise.com',
    // Grabbers de IP / logging
    'grabify.link', 'iplogger.', 'blasze.', '2no.co', 'yip.su', 'iplis.ru', 'ipgrabber.',
];

/** Frases típicas de estafa. Solo se consideran graves si vienen con un enlace. */
const FRASES_ESTAFA = [
    'nitro gratis', 'free nitro', 'nitro free', 'regalo de nitro', 'giveaway nitro', 'claim your nitro',
    '1 mes de nitro', '3 meses de nitro', 'steam gift', 'regalo de steam', 'free steam',
    'crypto giveaway', 'airdrop gratis', 'free airdrop',
    'onlyfans gratis', 'packs gratis', 'nudes gratis', 'leaked nudes', 'teen leaks',
    'who is this girl', 'quien es esta chica', 'verifica tu cuenta', 'verify your account',
    'te regalo', 'gratis para los primeros',
];

/** Promoción de otros canales/comunidades. */
const RE_PROMO = /(?:twitch\.tv\/|kick\.com\/|youtube\.com\/(?:channel\/|c\/|@)|t\.me\/|telegram\.me\/|whatsapp\.com\/(?:chat|invite))/i;

/**
 * Señales de que alguien está escondiendo un enlace a propósito:
 * "discord [.] gg", "discord punto gg", "hxxp://", "dominio (.) com".
 */
const RE_OFUSCACION = /[\[\(\{<]\s*\.\s*[\]\)\}>]|\s(?:dot|punto)\s|h[x*#]{2}ps?:\/\/|[a-z0-9]\s+\.\s*[a-z]{2,}|[a-z0-9]\s*\.\s+[a-z]{2,}\/|[·•]/i;

/** Cualquier enlace genérico. */
const RE_ENLACE = /(?:https?:\/\/|www\.)[^\s<>"']{2,}|\b[a-z0-9][a-z0-9-]{1,62}\.(?:com|net|org|gg|io|xyz|top|ru|link|click|shop|online|site|info|me|tv|cc|co|app|dev|live|store|club|fun|vip|lol|gift|pw|su|to|ly|biz|icu)\b(?:\/[^\s]*)?/i;

// ─────────────────────────────────────────────────────────────────────────────
// 3. ANÁLISIS DEL CONTENIDO
// ─────────────────────────────────────────────────────────────────────────────

export type TipoAmenaza = 'ninguna' | 'enlace' | 'promo' | 'invite' | 'estafa' | 'menciones';

export interface Analisis {
    tipo: TipoAmenaza;
    detalle: string;
    /** true si el contenido es peligroso pase lo que pase (ni los admins lo pueden enviar sin alerta). */
    critico: boolean;
    hayEnlace: boolean;
    huella: string;
}

function estaPermitido(agresivo: string): boolean {
    const permitidos = [...DOMINIOS_BASE_PERMITIDOS, ...getConfig().dominiosPermitidos];
    return permitidos.some(d => agresivo.includes(d));
}

export function analizar(message: Message): Analisis {
    const bruto = extraerTexto(message);
    const plano = normalizarPlano(bruto);
    const agresivo = normalizarAgresivo(plano);

    const huella = agresivo.replace(/[^a-z0-9]/g, '').slice(0, 120);

    // El texto agresivo pega los puntos ("termine. Comparto" → "termine.comparto"),
    // así que solo lo usamos para buscar enlaces cuando hay señales evidentes de
    // ofuscación. Si no, una frase normal en español podría parecer un dominio.
    const hayOfuscacion = RE_OFUSCACION.test(plano);
    const hayEnlace = RE_ENLACE.test(plano) || RE_INVITE.test(agresivo) || (hayOfuscacion && RE_ENLACE.test(agresivo));

    // 3.a Phishing / estafa → siempre crítico.
    const dominioEstafa = DOMINIOS_ESTAFA.find(d => agresivo.includes(d));
    if (dominioEstafa) {
        return { tipo: 'estafa', detalle: `Dominio de phishing/estafa: \`${dominioEstafa}\``, critico: true, hayEnlace, huella };
    }
    const fraseEstafa = FRASES_ESTAFA.find(f => plano.includes(f) || agresivo.includes(f.replace(/ /g, '')));
    if (fraseEstafa && hayEnlace) {
        return { tipo: 'estafa', detalle: `Cebo de estafa + enlace: \`${fraseEstafa}\``, critico: true, hayEnlace, huella };
    }

    // 3.b Menciones masivas.
    const totalMenciones = message.mentions.users.size + message.mentions.roles.size;
    if (totalMenciones >= 6 || (message.mentions.everyone && !message.member?.permissions.has(PermissionFlagsBits.MentionEveryone))) {
        return { tipo: 'menciones', detalle: `Menciones masivas (${totalMenciones}${message.mentions.everyone ? ' + @everyone' : ''})`, critico: true, hayEnlace, huella };
    }

    // Los dominios de la lista blanca cortan aquí (GIFs, TikTok de Daki, etc.).
    if (estaPermitido(agresivo)) {
        return { tipo: 'ninguna', detalle: '', critico: false, hayEnlace, huella };
    }

    // 3.c Invitaciones a otros servidores.
    if (RE_INVITE.test(agresivo)) {
        return { tipo: 'invite', detalle: 'Invitación a otro servidor de Discord', critico: false, hayEnlace: true, huella };
    }

    // 3.d Promoción de otros canales.
    if (RE_PROMO.test(agresivo) || RE_PROMO.test(plano)) {
        return { tipo: 'promo', detalle: 'Promoción de otra plataforma/canal', critico: false, hayEnlace: true, huella };
    }

    // 3.e Enlace genérico.
    if (hayEnlace) {
        return { tipo: 'enlace', detalle: 'Enlace externo no permitido', critico: false, hayEnlace: true, huella };
    }

    if (fraseEstafa) {
        return { tipo: 'estafa', detalle: `Cebo de estafa (sin enlace): \`${fraseEstafa}\``, critico: false, hayEnlace, huella };
    }

    return { tipo: 'ninguna', detalle: '', critico: false, hayEnlace, huella };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SEGUIMIENTO DE ACTIVIDAD (detector de raid)
// ─────────────────────────────────────────────────────────────────────────────

interface Huella {
    t: number;
    canalId: string;
    mensajeId: string;
    huella: string;
}

export interface Actividad {
    historial: Huella[];
    strikes: number;
    ultimoAvisoPublico: number;
    enRaid: boolean;
}

const actividad = new Map<string, Actividad>();
const VENTANA_MS = 25_000;      // ventana de observación
const RAID_CANALES = 4;         // canales distintos en la ventana → raid multicanal
const RAID_DUPLICADOS = 3;      // mismo texto en N canales → cross-post
const FLOOD_MENSAJES = 9;       // mensajes en 10s → flood

/** Usuarios marcados como atacantes hace poco (para detectar raid coordinado). */
const raidsRecientes = new Map<string, number>();
const RAID_GLOBAL_USUARIOS = 3;
const RAID_GLOBAL_VENTANA = 60_000;

function claveMiembro(guildId: string, userId: string) {
    return `${guildId}:${userId}`;
}

function obtenerActividad(clave: string): Actividad {
    let a = actividad.get(clave);
    if (!a) {
        a = { historial: [], strikes: 0, ultimoAvisoPublico: 0, enRaid: false };
        actividad.set(clave, a);
    }
    return a;
}

// Limpieza periódica para que el Map no crezca sin límite en un servidor activo.
const limpieza = setInterval(() => {
    const corte = Date.now() - 5 * 60_000;
    for (const [clave, a] of actividad) {
        a.historial = a.historial.filter(h => h.t > corte);
        if (!a.historial.length && a.strikes === 0) actividad.delete(clave);
    }
    for (const [id, t] of raidsRecientes) {
        if (t < Date.now() - RAID_GLOBAL_VENTANA) raidsRecientes.delete(id);
    }
}, 60_000);
limpieza.unref?.();

export interface Veredicto {
    esRaid: boolean;
    motivo: string;
    canalesAfectados: number;
}

// Exportada para poder probarla de forma aislada (ver pruebas del guardián).
export function evaluarRaid(a: Actividad, ahora: number): Veredicto {
    const ventana = a.historial.filter(h => h.t > ahora - VENTANA_MS);
    const canales = new Set(ventana.map(h => h.canalId));

    if (canales.size >= RAID_CANALES) {
        return { esRaid: true, motivo: `Publicó en ${canales.size} canales distintos en ${VENTANA_MS / 1000}s`, canalesAfectados: canales.size };
    }

    // Mismo contenido repetido en varios canales (el patrón exacto del ataque).
    const porHuella = new Map<string, Set<string>>();
    for (const h of ventana) {
        if (h.huella.length < 8) continue;
        if (!porHuella.has(h.huella)) porHuella.set(h.huella, new Set());
        porHuella.get(h.huella)!.add(h.canalId);
    }
    for (const [, cs] of porHuella) {
        if (cs.size >= RAID_DUPLICADOS) {
            return { esRaid: true, motivo: `Repitió el mismo mensaje en ${cs.size} canales`, canalesAfectados: cs.size };
        }
    }

    const rapidos = ventana.filter(h => h.t > ahora - 10_000);
    if (rapidos.length >= FLOOD_MENSAJES) {
        return { esRaid: true, motivo: `Flood: ${rapidos.length} mensajes en 10s`, canalesAfectados: new Set(rapidos.map(r => r.canalId)).size };
    }

    return { esRaid: false, motivo: '', canalesAfectados: canales.size };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ACCIONES
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultadoSancion {
    aplicada: 'ban' | 'kick' | 'timeout' | 'ninguna';
    error?: string;
}

/**
 * Aplica la sanción más fuerte que la configuración permita Y que el bot pueda
 * ejecutar. Si no puede hacer nada, lo dice claramente (nunca falla en silencio).
 */
export async function sancionar(member: GuildMember, motivo: string, duracionMs: number): Promise<ResultadoSancion> {
    const cfg = getConfig();
    const yo = member.guild.members.me;
    if (!yo) return { aplicada: 'ninguna', error: 'No tengo mi propio miembro en caché.' };

    if (member.id === member.guild.ownerId) {
        return { aplicada: 'ninguna', error: 'Es el propietario del servidor: Discord no permite sancionarlo.' };
    }
    if (yo.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
        return { aplicada: 'ninguna', error: 'Mi rol está POR DEBAJO del suyo en la jerarquía. Sube el rol del bot.' };
    }

    const intentos: (() => Promise<ResultadoSancion>)[] = [];

    if (cfg.sancionMaxima === 'ban') {
        intentos.push(async () => {
            if (!yo.permissions.has(PermissionFlagsBits.BanMembers) || !member.bannable) throw new Error('sin permiso de banear');
            // deleteMessageSeconds borra también su historial reciente en todo el servidor.
            await member.ban({ reason: motivo, deleteMessageSeconds: 7 * 24 * 3600 });
            return { aplicada: 'ban' as const };
        });
    }
    if (cfg.sancionMaxima === 'ban' || cfg.sancionMaxima === 'kick') {
        intentos.push(async () => {
            if (!yo.permissions.has(PermissionFlagsBits.KickMembers) || !member.kickable) throw new Error('sin permiso de expulsar');
            await member.kick(motivo);
            return { aplicada: 'kick' as const };
        });
    }
    // El timeout es siempre el último recurso: es el que menos permisos exige.
    intentos.push(async () => {
        if (!yo.permissions.has(PermissionFlagsBits.ModerateMembers) || !member.moderatable) throw new Error('sin permiso de aislar');
        await member.timeout(Math.min(duracionMs, 28 * 24 * 3600 * 1000), motivo);
        return { aplicada: 'timeout' as const };
    });

    let ultimoError = '';
    for (const intento of intentos) {
        try {
            return await intento();
        } catch (e: any) {
            ultimoError = e?.message ?? String(e);
        }
    }
    return { aplicada: 'ninguna', error: `No pude sancionarlo (${ultimoError}). Revisa permisos y jerarquía de roles.` };
}

/** Borra en bloque los mensajes que el guardián ya tenía fichados de este usuario. */
async function purgarFichados(guild: Guild, historial: Huella[]): Promise<number> {
    const porCanal = new Map<string, string[]>();
    for (const h of historial) {
        if (!porCanal.has(h.canalId)) porCanal.set(h.canalId, []);
        porCanal.get(h.canalId)!.push(h.mensajeId);
    }

    let borrados = 0;
    for (const [canalId, ids] of porCanal) {
        const canal = guild.channels.cache.get(canalId) ?? await guild.channels.fetch(canalId).catch(() => null);
        if (!canal || !canal.isTextBased()) continue;
        try {
            const res = await (canal as TextChannel).bulkDelete(ids, true);
            borrados += res.size;
        } catch {
            // bulkDelete falla con 1 solo mensaje viejo o sin permisos: probamos uno a uno.
            for (const id of ids) {
                await (canal as TextChannel).messages.delete(id).then(() => { borrados++; }).catch(() => null);
            }
        }
    }
    return borrados;
}

/**
 * Barrido completo: recorre TODOS los canales de texto (incluidos los chats de
 * los canales de voz) y borra los mensajes recientes de un usuario.
 * Lo usa /limpiar-usuario, cuando ya no basta con los mensajes fichados.
 */
export async function barrerUsuario(guild: Guild, userId: string, minutos: number): Promise<{ borrados: number; canalesRevisados: number; sinPermiso: string[] }> {
    const desde = Date.now() - minutos * 60_000;
    const yo = guild.members.me;
    let borrados = 0;
    let canalesRevisados = 0;
    const sinPermiso: string[] = [];

    const canales = (await guild.channels.fetch().catch(() => null)) ?? guild.channels.cache;

    for (const canal of canales.values()) {
        if (!canal || !canal.isTextBased()) continue;
        const perms = yo ? canal.permissionsFor(yo) : null;
        if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.ReadMessageHistory)) continue;
        if (!perms.has(PermissionFlagsBits.ManageMessages)) {
            sinPermiso.push(`<#${canal.id}>`);
            continue;
        }

        canalesRevisados++;
        try {
            const mensajes = await (canal as TextChannel).messages.fetch({ limit: 100 });
            const objetivo = mensajes.filter(m => m.author.id === userId && m.createdTimestamp >= desde);
            if (!objetivo.size) continue;
            const res = await (canal as TextChannel).bulkDelete(objetivo, true);
            borrados += res.size;
        } catch {
            // Canal sin historial accesible o mensajes de más de 14 días.
        }
    }

    return { borrados, canalesRevisados, sinPermiso };
}

/**
 * Cierre de emergencia: quita "Enviar mensajes" a @everyone en todos los
 * canales, guardando el estado anterior para poder revertirlo exactamente.
 */
export async function aplicarLockdown(guild: Guild, activar: boolean, motivo: string): Promise<{ cambiados: number; fallidos: string[] }> {
    const cfg = getConfig();
    const everyone = guild.roles.everyone;
    const yo = guild.members.me;
    const respaldo: Record<string, boolean | null> = activar ? {} : { ...cfg.lockdown.respaldo };

    const TIPOS = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildVoice, ChannelType.GuildStageVoice];
    const canales = (await guild.channels.fetch().catch(() => null)) ?? guild.channels.cache;

    let cambiados = 0;
    const fallidos: string[] = [];

    for (const canal of canales.values()) {
        if (!canal || !TIPOS.includes(canal.type as any)) continue;
        const c = canal as GuildBasedChannel & { permissionOverwrites: any };
        const perms = yo ? canal.permissionsFor(yo) : null;
        if (!perms?.has(PermissionFlagsBits.ManageChannels) || !perms.has(PermissionFlagsBits.ViewChannel)) {
            fallidos.push(`<#${canal.id}> (sin permiso de gestionar canal)`);
            continue;
        }

        try {
            if (activar) {
                const ow = c.permissionOverwrites.cache.get(everyone.id);
                const previo: boolean | null = ow?.allow?.has(PermissionFlagsBits.SendMessages) ? true
                    : ow?.deny?.has(PermissionFlagsBits.SendMessages) ? false
                    : null;
                respaldo[canal.id] = previo;
                await c.permissionOverwrites.edit(everyone, {
                    SendMessages: false,
                    SendMessagesInThreads: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false,
                    AddReactions: false,
                }, { reason: `Lockdown: ${motivo}` });
            } else {
                const previo = respaldo[canal.id] ?? null;
                await c.permissionOverwrites.edit(everyone, {
                    SendMessages: previo,
                    SendMessagesInThreads: null,
                    CreatePublicThreads: null,
                    CreatePrivateThreads: null,
                    AddReactions: null,
                }, { reason: `Fin del lockdown: ${motivo}` });
            }
            cambiados++;
        } catch (e: any) {
            fallidos.push(`<#${canal.id}> (${e?.message ?? 'error'})`);
        }
    }

    setConfig({ lockdown: { activo: activar, respaldo: activar ? respaldo : {} } });

    await registrar(guild, {
        gravedad: activar ? 'critica' : 'info',
        titulo: activar ? 'SERVIDOR CERRADO (lockdown)' : 'Servidor reabierto',
        descripcion: `${motivo}\n\nCanales modificados: **${cambiados}**` + (fallidos.length ? `\nNo pude tocar: ${fallidos.slice(0, 10).join(', ')}` : ''),
        pingMods: activar,
    });

    return { cambiados, fallidos };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUNTO DE ENTRADA
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Este miembro está exento del FILTRO DE ENLACES? (nunca del detector de raid). */
function exentoDeEnlaces(member: GuildMember | null, canalId: string): boolean {
    const cfg = getConfig();
    if (cfg.canalesExentos.includes(canalId)) return true;
    if (!member) return false;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    return cfg.rolesExentos.some(r => member.roles.cache.has(r));
}

async function borrarMensaje(message: Message): Promise<boolean> {
    if (!message.deletable) {
        await registrar(message.guild, {
            gravedad: 'grave',
            titulo: 'NO PUDE BORRAR UN MENSAJE PELIGROSO',
            descripcion: `Canal: <#${message.channelId}>\nMe falta el permiso **Gestionar mensajes** ahí.`,
            pingMods: true,
        });
        return false;
    }
    try {
        await message.delete();
        return true;
    } catch (e: any) {
        await registrar(message.guild, {
            gravedad: 'grave',
            titulo: 'FALLO AL BORRAR UN MENSAJE PELIGROSO',
            descripcion: `Canal: <#${message.channelId}>\nError: \`${e?.message ?? e}\``,
            pingMods: true,
        });
        return false;
    }
}

/** Aviso público breve y autolimitado. Se calla durante un raid para no amplificar el flood. */
async function avisoPublico(message: Message, a: Actividad, texto: string, color: string) {
    const ahora = Date.now();
    if (a.enRaid) return;
    if (ahora - a.ultimoAvisoPublico < 20_000) return;
    a.ultimoAvisoPublico = ahora;

    const canal = message.channel;
    if (!canal.isTextBased() || !('send' in canal)) return;
    const embed = new EmbedBuilder().setColor(color as any).setDescription(texto).setFooter({ text: 'Guardián de Daki' });
    const msg = await (canal as TextChannel).send({ embeds: [embed] }).catch(() => null);
    if (msg) setTimeout(() => msg.delete().catch(() => null), 8000);
}

/**
 * Inspecciona un mensaje. Devuelve true si el guardián actuó (el mensaje ya no
 * existe y el resto del pipeline —XP, IA— debe detenerse).
 */
export async function inspeccionar(message: Message): Promise<boolean> {
    const cfg = getConfig();
    if (!cfg.activo) return false;
    if (!message.guild) return false;
    if (message.author.id === message.client.user?.id) return false;

    const analisis = analizar(message);

    // Los webhooks no se pueden sancionar, pero sí borrar y reportar.
    if (message.webhookId) {
        if (analisis.tipo === 'estafa' || analisis.tipo === 'invite' || analisis.tipo === 'menciones') {
            await borrarMensaje(message);
            await registrar(message.guild, {
                gravedad: 'grave',
                titulo: 'Webhook enviando contenido peligroso',
                descripcion: `Canal: <#${message.channelId}>\nWebhook: \`${message.webhookId}\`\n${analisis.detalle}\n\n**Revisa y elimina ese webhook en los ajustes del canal.**`,
                pingMods: true,
            });
            return true;
        }
        return false;
    }
    if (message.author.bot) return false;

    const clave = claveMiembro(message.guild.id, message.author.id);
    const a = obtenerActividad(clave);
    const ahora = Date.now();

    // Fichamos el mensaje SIEMPRE (con o sin enlace): así el detector de raid ve
    // el patrón completo. Este era el agujero grande: antes los mensajes con
    // enlace hacían return y nunca contaban para el escalado.
    a.historial.push({ t: ahora, canalId: message.channelId, mensajeId: message.id, huella: analisis.huella });
    if (a.historial.length > 60) a.historial = a.historial.slice(-60);

    const veredicto = evaluarRaid(a, ahora);
    const contenidoMalicioso = analisis.tipo !== 'ninguna';
    const exento = exentoDeEnlaces(message.member, message.channelId);

    // ── CASO 1: RAID ─────────────────────────────────────────────────────────
    // Aplica AUNQUE el usuario sea admin o mod: una cuenta comprometida de un
    // mod es exactamente el escenario que nos reventó antes.
    if (veredicto.esRaid && (contenidoMalicioso || veredicto.canalesAfectados >= RAID_CANALES)) {
        a.enRaid = true;
        raidsRecientes.set(message.author.id, ahora);

        await borrarMensaje(message);
        const borrados = await purgarFichados(message.guild, a.historial.filter(h => h.t > ahora - 10 * 60_000));

        const sancion = message.member
            ? await sancionar(message.member, `Raid detectado: ${veredicto.motivo}`, 24 * 3600 * 1000)
            : { aplicada: 'ninguna' as const, error: 'Miembro no disponible (¿ya salió del servidor?)' };

        a.historial = [];
        a.strikes += 5;

        await registrar(message.guild, {
            gravedad: 'critica',
            titulo: 'RAID DETECTADO Y CORTADO',
            descripcion: `**Usuario:** ${etiquetaUsuario(message.author.id, message.author.tag)}\n**Patrón:** ${veredicto.motivo}`,
            campos: [
                { name: 'Contenido', value: analisis.detalle || 'Sin enlace, solo flood', inline: false },
                { name: 'Mensajes borrados', value: `${borrados + 1}`, inline: true },
                { name: 'Canales afectados', value: `${veredicto.canalesAfectados}`, inline: true },
                { name: 'Sanción', value: sancion.aplicada === 'ninguna' ? `❌ **NINGUNA** — ${sancion.error}` : `✅ ${sancion.aplicada}`, inline: false },
            ],
            pingMods: true,
        });

        // Raid coordinado: varias cuentas atacando a la vez.
        const atacantes = [...raidsRecientes.values()].filter(t => t > ahora - RAID_GLOBAL_VENTANA).length;
        const critico = atacantes >= RAID_GLOBAL_USUARIOS;

        if (critico) {
            await registrar(message.guild, {
                gravedad: 'critica',
                titulo: 'RAID COORDINADO',
                descripcion: `**${atacantes} cuentas** atacando en el último minuto.`,
                pingMods: true,
            });
        }

        if (cfg.autoLockdown && (critico || veredicto.canalesAfectados >= RAID_CANALES) && !getConfig().lockdown.activo) {
            await aplicarLockdown(message.guild, true, `Cierre automático por raid de ${message.author.tag}`);
            await avisarPropietario(message.guild,
                `🛑 **Cierre de emergencia en ${message.guild.name}**\nDetecté un raid de \`${message.author.tag}\` (${veredicto.motivo}) y cerré los canales.\nUsa \`/lockdown accion:desactivar\` cuando esté controlado.`);
        } else if (sancion.aplicada === 'ninguna') {
            // No pudimos castigar: al menos que un humano se entere ya.
            await avisarPropietario(message.guild,
                `🚨 **Raid en ${message.guild.name} y NO pude sancionar al atacante**\nUsuario: \`${message.author.tag}\` (${message.author.id})\nMotivo del fallo: ${sancion.error}\nPatrón: ${veredicto.motivo}`);
        }

        return true;
    }

    if (!contenidoMalicioso) return false;

    // ── CASO 2: CONTENIDO CRÍTICO (phishing, menciones masivas) ──────────────
    // Se borra siempre, incluso a un admin. Si es admin no se sanciona, pero se
    // alerta: si un admin manda phishing, su cuenta está comprometida.
    if (analisis.critico) {
        await borrarMensaje(message);

        if (exento) {
            await registrar(message.guild, {
                gravedad: 'critica',
                titulo: 'CONTENIDO PELIGROSO ENVIADO POR UN USUARIO CON PERMISOS',
                descripcion: `**Usuario:** ${etiquetaUsuario(message.author.id, message.author.tag)}\n${analisis.detalle}\n\n⚠️ **Es staff/exento: borré el mensaje pero NO lo sancioné.**\nSi no fue él a propósito, su cuenta está comprometida: quítale los roles y que cambie la contraseña + active 2FA.`,
                campos: [{ name: 'Canal', value: `<#${message.channelId}>`, inline: true }],
                pingMods: true,
            });
            await avisarPropietario(message.guild,
                `🚨 **${message.guild.name}**: \`${message.author.tag}\` (staff) envió contenido de phishing/estafa. Borré el mensaje pero no puedo sancionar a alguien con sus permisos. Revisa su cuenta.`);
            return true;
        }

        a.strikes += 3;
        const sancion = message.member
            ? await sancionar(message.member, `Contenido peligroso: ${analisis.detalle}`, 24 * 3600 * 1000)
            : { aplicada: 'ninguna' as const, error: 'Miembro no disponible' };

        // Barremos sus mensajes recientes: casi nunca manda solo uno.
        const borrados = await purgarFichados(message.guild, a.historial.filter(h => h.t > ahora - 5 * 60_000));
        a.historial = [];

        await avisoPublico(message, a,
            `🛑 **Mensaje bloqueado.** ${message.author} intentó enviar un enlace peligroso y ha sido sancionado.`, '#FF0000');

        await registrar(message.guild, {
            gravedad: 'grave',
            titulo: 'Contenido peligroso bloqueado',
            descripcion: `**Usuario:** ${etiquetaUsuario(message.author.id, message.author.tag)}\n${analisis.detalle}`,
            campos: [
                { name: 'Canal', value: `<#${message.channelId}>`, inline: true },
                { name: 'Mensajes borrados', value: `${borrados + 1}`, inline: true },
                { name: 'Sanción', value: sancion.aplicada === 'ninguna' ? `❌ **NINGUNA** — ${sancion.error}` : `✅ ${sancion.aplicada}`, inline: false },
                { name: 'Texto (recortado)', value: '```' + (message.content || '(sin texto)').slice(0, 300).replace(/`/g, '´') + '```', inline: false },
            ],
            pingMods: true,
        });
        return true;
    }

    // ── CASO 3: ENLACE / INVITE / PROMO NORMAL ───────────────────────────────
    if (exento) return false;

    await borrarMensaje(message);
    a.strikes += analisis.tipo === 'enlace' ? 1 : 2;

    let sancion: ResultadoSancion = { aplicada: 'ninguna' };
    // Escalado por reincidencia: el primer enlace solo se borra; a partir del
    // tercer strike hay aislamiento, y sube con cada reincidencia.
    if (a.strikes >= 3 && message.member) {
        const minutos = a.strikes >= 8 ? 60 : a.strikes >= 5 ? 30 : 10;
        sancion = await sancionar(message.member, `Reincidencia (${a.strikes} strikes): ${analisis.detalle}`, minutos * 60_000);
    }

    await avisoPublico(message, a,
        sancion.aplicada !== 'ninguna'
            ? `⚠️ **${message.author}** — enlaces no permitidos. Reincidencia: silenciado temporalmente.`
            : `⚠️ **Alto ahí, ${message.author}.** No se permiten enlaces externos aquí.`,
        sancion.aplicada !== 'ninguna' ? '#FF6600' : '#FFCC00');

    await registrar(message.guild, {
        gravedad: 'aviso',
        titulo: `Enlace eliminado (${analisis.tipo})`,
        descripcion: `**Usuario:** ${etiquetaUsuario(message.author.id, message.author.tag)}\n${analisis.detalle}`,
        campos: [
            { name: 'Canal', value: `<#${message.channelId}>`, inline: true },
            { name: 'Strikes', value: `${a.strikes}`, inline: true },
            { name: 'Sanción', value: sancion.aplicada === 'ninguna' ? '— (solo borrado)' : sancion.aplicada, inline: true },
            { name: 'Texto (recortado)', value: '```' + (message.content || '(sin texto)').slice(0, 300).replace(/`/g, '´') + '```', inline: false },
        ],
    });

    // Los strikes caducan: no queremos castigar por un enlace de hace un mes.
    setTimeout(() => { a.strikes = Math.max(0, a.strikes - 1); }, 10 * 60_000);

    return true;
}
