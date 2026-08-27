import { Events, Message, EmbedBuilder } from 'discord.js';
import { CustomClient } from '../index.js';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { addXP, getLevelRoles } from '../utils/db.js';
import { inspeccionar, sancionar } from '../services/antiRaid.js';
import { registrar, etiquetaUsuario } from '../utils/modLog.js';

const xpCooldowns = new Set<string>();

interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

const channelHistory = new Map<string, ChatMessage[]>();
const userMessages = new Map<string, { count: number; timer: NodeJS.Timeout }>();
const LIMIT = 5; // messages
const TIME = 5000; // 5 seconds

// Cliente de IA reutilizado (antes se instanciaba uno nuevo en cada mensaje).
let aiClient: GoogleGenAI | null = null;
function getAiClient(apiKey: string): GoogleGenAI {
    if (!aiClient) aiClient = new GoogleGenAI({ apiKey });
    return aiClient;
}

// Candado por canal: serializa las peticiones de IA de un mismo canal para que
// el ciclo leer-historial → responder → guardar-historial sea atómico y dos
// mensajes simultáneos no se pisen ("el último gana").
const channelLocks = new Map<string, Promise<unknown>>();
function withChannelLock<T>(channelId: string, fn: () => Promise<T>): Promise<T> {
    const prev = channelLocks.get(channelId) ?? Promise.resolve();
    const next = prev.then(fn, fn); // se ejecuta pase lo que pase con el anterior
    channelLocks.set(channelId, next.catch(() => {}));
    return next;
}

// La clave combina servidor + usuario para no mezclar datos entre servidores
// distintos si el bot llegara a estar en más de uno.
function memberKey(message: Message): string {
    return `${message.guildId ?? 'dm'}:${message.author.id}`;
}

export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: CustomClient) {
        // Los webhooks también pueden ser secuestrados, así que el guardián los
        // revisa antes de descartar mensajes de bots.
        if (message.author.bot && !message.webhookId) return;

        // 1. GUARDIÁN: anti-enlaces, anti-phishing y detector de raid.
        // Va primero y es la única puerta: si actúa, el mensaje ya no existe.
        try {
            if (await inspeccionar(message)) return;
        } catch (error) {
            console.error('[GUARDIAN] Error inesperado inspeccionando el mensaje:', error);
        }

        if (message.author.bot) return;

        // 2. ANTI-SPAM (flood en un mismo canal, sin enlaces)
        const spamKey = memberKey(message);
        if (!userMessages.has(spamKey)) {
            userMessages.set(spamKey, {
                count: 1,
                timer: setTimeout(() => userMessages.delete(spamKey), TIME)
            });
        } else {
            const userData = userMessages.get(spamKey);
            if (userData) {
                userData.count++;
                if (userData.count > LIMIT && !message.member?.permissions.has('ManageGuild')) {
                    await message.delete().catch(() => null);

                    // Solo avisamos en el primer aviso del ciclo para no sumar ruido al flood.
                    if (userData.count === LIMIT + 1 && message.channel.isTextBased() && 'send' in message.channel) {
                        const embed = new EmbedBuilder()
                            .setColor('#FF3366')
                            .setDescription(`🛑 **¡Oye, ${message.author}!**\nDeja de hacer spam. Te silencio un momento.`)
                            .setFooter({ text: 'Guardián de Daki' });
                        const aviso = await (message.channel as any).send({ embeds: [embed] }).catch(() => null);
                        if (aviso) setTimeout(() => aviso.delete().catch(() => null), 8000);
                    }

                    if (message.member && userData.count === LIMIT + 1) {
                        const res = await sancionar(message.member, 'Spam (flood de mensajes)', 5 * 60_000);
                        await registrar(message.guild, {
                            gravedad: 'aviso',
                            titulo: 'Spam bloqueado',
                            descripcion: `**Usuario:** ${etiquetaUsuario(message.author.id, message.author.tag)}\n${userData.count} mensajes en ${TIME / 1000}s`,
                            campos: [
                                { name: 'Canal', value: `<#${message.channelId}>`, inline: true },
                                { name: 'Sanción', value: res.aplicada === 'ninguna' ? `❌ ${res.error}` : `✅ ${res.aplicada}`, inline: true },
                            ],
                        });
                    }
                    return;
                }
            }
        }

        // 2.5 SISTEMA DE EXPERIENCIA (XP)
        const xpKey = memberKey(message);
        if (!xpCooldowns.has(xpKey)) {
            const xpGained = Math.floor(Math.random() * 11) + 15; // 15 a 25 XP por mensaje
            const { hasLeveledUp, newLevel } = addXP(message.author.id, xpGained);

            if (hasLeveledUp) {
                let description = `🎉 **¡NUEVO NIVEL!**\nOye <@${message.author.id}>, acabas de subir al **Nivel ${newLevel}**. ¡Estás on fire! 🔥`;

                // Verificar si hay una recompensa de rol para este nivel
                const roles = getLevelRoles();
                const roleIdForLevel = roles[newLevel.toString()];

                if (roleIdForLevel && message.member) {
                    try {
                        await message.member.roles.add(roleIdForLevel);
                        description += `\n\n🏅 **¡Recompensa Desbloqueada!** Te he asignado el rol <@&${roleIdForLevel}>.`;
                    } catch (error) {
                        console.error('Error al asignar el rol de recompensa:', error);
                    }
                }

                const levelUpEmbed = new EmbedBuilder()
                    .setColor('#CCFF00')
                    .setDescription(description);
                
                if (message.channel.isTextBased() && 'send' in message.channel) {
                    await (message.channel as any).send({ embeds: [levelUpEmbed] }).catch(() => {});
                }
            }

            xpCooldowns.add(xpKey);
            setTimeout(() => {
                xpCooldowns.delete(xpKey);
            }, 60000); // 1 minuto de cooldown para evitar farm de XP
        }

        // 3. MÓDULO DE INTELIGENCIA ARTIFICIAL (GEMINI CHAT)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return;

        // ignoreRoles evita que una mención de rol que contenga al bot dispare la IA.
        const isMentioned = message.mentions.has(client.user!, { ignoreRoles: true, ignoreEveryone: true });
        const isAiChannel = 'name' in message.channel && typeof (message.channel as any).name === 'string' && (
            (message.channel as any).name.includes('habla-con-daki') ||
            (message.channel as any).name.includes('daki-ia')
        );

        if (isMentioned || isAiChannel) {
            const channelId = message.channel.id;
            // Serializamos por canal para evitar la condición de carrera en el historial.
            await withChannelLock(channelId, async () => {
              try {
                // Indicamos que Daki está escribiendo
                if (message.channel.isTextBased() && 'sendTyping' in message.channel) {
                    await (message.channel as any).sendTyping();
                }

                const botMentionRegex = new RegExp(`<@!?${client.user!.id}>`, 'g');
                const cleanContent = message.content.replace(botMentionRegex, '').trim();

                if (!cleanContent && isMentioned) {
                    await message.reply('¡Hola! 💫 ¿En qué te puedo ayudar hoy? Escríbeme tu duda o consulta.').catch(() => null);
                    return;
                }

                if (!cleanContent) return;

                const ai = getAiClient(apiKey);

                // Obtenemos historial del canal
                let history = channelHistory.get(channelId) || [];

                // Mantenemos las últimas interacciones para no saturar los tokens de entrada.
                if (history.length > 6) {
                    history = history.slice(-6);
                }
                // Gemini exige que el historial empiece con un turno de 'user'.
                while (history.length && history[0].role !== 'user') {
                    history.shift();
                }

                const systemInstruction =
                    "Eres Daki Bot, el bot oficial encargado de moderar, limpiar el spam y mantener el orden en el servidor de Discord del streamer Daki. " +
                    "Tus respuestas en el chat deben ser secas, directas y cortas (máximo 2 o 3 oraciones sencillas, unas 40 palabras). " +
                    "Evita por completo sonar como una mona china de anime ('tsundere') o ser exageradamente infantil u hostil. " +
                    "En su lugar, compórtate como un moderador real de chat: relajado, con un humor irónico, sarcástico y pasivo-agresivo sobrio, " +
                    "como un amigo maduro que te tira carrilla inteligente y un poco seca en los streams. " +
                    "Si te preguntan quién eres, aclara con orgullo pero con tu toque sarcástico que eres el bot de moderación de Daki.";

                const chat = ai.chats.create({
                    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                    history: history,
                    config: {
                        systemInstruction: systemInstruction,
                        temperature: 0.7,
                        thinkingConfig: {
                            thinkingLevel: (process.env.GEMINI_THINKING_LEVEL?.toUpperCase() === 'LOW' ? ThinkingLevel.LOW :
                                            process.env.GEMINI_THINKING_LEVEL?.toUpperCase() === 'MEDIUM' ? ThinkingLevel.MEDIUM :
                                            process.env.GEMINI_THINKING_LEVEL?.toUpperCase() === 'HIGH' ? ThinkingLevel.HIGH :
                                            ThinkingLevel.MINIMAL)
                        }
                    }
                });

                const response = await chat.sendMessage({ message: cleanContent });
                const answer = response.text || 'Ups, mis circuitos cerebrales se cruzaron un poco. ¿Podrías repetir eso?';

                // Guardamos el historial actualizado
                const updatedHistory = await chat.getHistory();
                channelHistory.set(channelId, updatedHistory as ChatMessage[]);

                // Respondemos al usuario dividiendo el mensaje si es necesario
                if (answer.length > 2000) {
                    const chunks = [];
                    for (let i = 0; i < answer.length; i += 1900) {
                        chunks.push(answer.substring(i, i + 1900));
                    }

                    await message.reply(chunks[0]).catch(() => null);
                    for (let i = 1; i < chunks.length; i++) {
                        if ('send' in message.channel) {
                            await (message.channel as any).send(chunks[i]).catch(() => null);
                        }
                    }
                } else {
                    await message.reply(answer).catch(() => null);
                }
              } catch (error: any) {
                console.error('Error en chat de IA de Daki:', error);
                // El mensaje pudo haberse borrado (anti-link/anti-spam); protegemos el reply.
                await message.reply('⏳ Estoy teniendo problemas para procesar. Dame 1 minuto.').catch(() => null);
              }
            });
        }
    }
};
