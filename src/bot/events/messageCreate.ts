import { Events, Message, EmbedBuilder } from 'discord.js';
import { CustomClient } from '../index.js';
import { GoogleGenAI } from '@google/genai';
import { addXP, getLevelRoles } from '../utils/db.js';

const xpCooldowns = new Set<string>();

interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

const channelHistory = new Map<string, ChatMessage[]>();
const userMessages = new Map<string, { count: number; timer: NodeJS.Timeout }>();
const LIMIT = 5; // messages
const TIME = 5000; // 5 seconds

export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: CustomClient) {
        if (message.author.bot) return;

        // 1. ANTI-LINKS / ANTI-PROMO
        if (message.member && !message.member.permissions.has('ManageMessages')) {
            const content = message.content.toLowerCase();
            
            // 1.a. Enlaces permitidos por defecto (GIFs)
            const isAllowed = /tenor\.com|giphy\.com/i.test(content);

            if (!isAllowed) {
                // 1.b. Promociones descaradas o Scams
                const promoRegex = /(discord\.gg\/|discord\.com\/invite\/|t\.me\/|twitch\.tv\/|youtube\.com\/channel\/|free nitro|nitro gratis|steamcommunity\.com\/gift)/i;
                // 1.c. Cualquier otro enlace general
                const linkRegex = /https?:\/\/[^\s]+/i;

                if (promoRegex.test(content)) {
                    try {
                        await message.delete();
                        if (message.channel.isTextBased() && 'send' in message.channel) {
                            const embed = new EmbedBuilder()
                                .setColor('#FF0000') // Rojo intenso
                                .setTitle('🚨 ¡ALERTA DE SEGURIDAD!')
                                .setDescription(`**${message.author}** intentó enviar un enlace de promoción o posible estafa.\nEl usuario ha sido silenciado para proteger el servidor.`)
                                .setFooter({ text: 'Sistema Anti-Raid Daki' });
                            await message.channel.send({ embeds: [embed] });
                        }
                        // Mutear automáticamente por 10 minutos
                        await message.member.timeout(10 * 60 * 1000, 'Promoción no autorizada o Scam');
                    } catch (e) {
                        console.error("Fallo al borrar promo o mutear:", e);
                    }
                    return;
                } else if (linkRegex.test(content)) {
                    try {
                        await message.delete();
                        if (message.channel.isTextBased() && 'send' in message.channel) {
                            const embed = new EmbedBuilder()
                                .setColor('#FFCC00')
                                .setDescription(`⚠️ **¡Alto ahí, ${message.author}!**\nNo está permitido enviar enlaces externos en este servidor.`)
                                .setFooter({ text: 'Sistema de Seguridad Daki' });
                            
                            const warningMsg = await message.channel.send({ embeds: [embed] });
                            // Borrar la advertencia después de 8 segundos para no ensuciar el chat
                            setTimeout(() => warningMsg.delete().catch(() => null), 8000);
                        }
                    } catch (e) {
                        console.error("Fallo al borrar link general:", e);
                    }
                    return;
                }
            }
        }

        // 2. ANTI-SPAM
        if (!userMessages.has(message.author.id)) {
            userMessages.set(message.author.id, { 
                count: 1, 
                timer: setTimeout(() => userMessages.delete(message.author.id), TIME) 
            });
        } else {
            const userData = userMessages.get(message.author.id);
            if (userData) {
                userData.count++;
                if (userData.count > LIMIT) {
                    try {
                        await message.delete();
                        if (message.channel.isTextBased() && 'send' in message.channel) {
                            const embed = new EmbedBuilder()
                                .setColor('#FF3366')
                                .setDescription(`🛑 **¡Oye, ${message.author}!**\nPor favor, deja de hacer spam. Has sido silenciado temporalmente.`)
                                .setFooter({ text: 'Sistema de Seguridad Daki' });
                            await message.channel.send({ embeds: [embed] });
                        }
                        
                        if (message.member) {
                            await message.member.timeout(60 * 1000, 'Spam'); // Mute for 1 minute
                        }
                    } catch (err) {
                        console.log('Faltan permisos para mutear o borrar mensaje en anti-spam.');
                    }
                    return;
                }
            }
        }

        // 2.5 SISTEMA DE EXPERIENCIA (XP)
        if (!xpCooldowns.has(message.author.id)) {
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

            xpCooldowns.add(message.author.id);
            setTimeout(() => {
                xpCooldowns.delete(message.author.id);
            }, 60000); // 1 minuto de cooldown para evitar farm de XP
        }

        // 3. MÓDULO DE INTELIGENCIA ARTIFICIAL (GEMINI CHAT)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return;

        const isMentioned = message.mentions.has(client.user!) && !message.mentions.everyone;
        const isAiChannel = 'name' in message.channel && typeof (message.channel as any).name === 'string' && (
            (message.channel as any).name.includes('habla-con-daki') || 
            (message.channel as any).name.includes('daki-ia')
        );

        if (isMentioned || isAiChannel) {
            try {
                // Indicamos que Daki está escribiendo
                if (message.channel.isTextBased() && 'sendTyping' in message.channel) {
                    await (message.channel as any).sendTyping();
                }

                const botMentionRegex = new RegExp(`<@!?${client.user!.id}>`, 'g');
                const cleanContent = message.content.replace(botMentionRegex, '').trim();

                if (!cleanContent && isMentioned) {
                    await message.reply('¡Hola! 💫 ¿En qué te puedo ayudar hoy? Escríbeme tu duda o consulta.');
                    return;
                }

                if (!cleanContent) return;

                const ai = new GoogleGenAI({ apiKey });
                
                // Obtenemos historial del canal
                let history = channelHistory.get(message.channel.id) || [];
                
                // Mantenemos las últimas 5 interacciones para no saturar los tokens de entrada
                if (history.length > 5) {
                    history = history.slice(-5);
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
                            thinkingLevel: process.env.GEMINI_THINKING_LEVEL || 'minimal'
                        }
                    }
                });

                const response = await chat.sendMessage({ message: cleanContent });
                const answer = response.text || 'Ups, mis circuitos cerebrales se cruzaron un poco. ¿Podrías repetir eso?';

                // Guardamos el historial actualizado
                const updatedHistory = await chat.getHistory();
                channelHistory.set(message.channel.id, updatedHistory as ChatMessage[]);

                // Respondemos al usuario dividiendo el mensaje si es necesario
                if (answer.length > 2000) {
                    const chunks = [];
                    for (let i = 0; i < answer.length; i += 1900) {
                        chunks.push(answer.substring(i, i + 1900));
                    }
                    
                    await message.reply(chunks[0]);
                    for (let i = 1; i < chunks.length; i++) {
                        if ('send' in message.channel) {
                            await (message.channel as any).send(chunks[i]);
                        }
                    }
                } else {
                    await message.reply(answer);
                }
            } catch (error: any) {
                console.error('Error en chat de IA de Daki:', error);
                if (error?.status === 429) {
                    await message.reply('⏳ ¡Tranquilos, banda! Me están bombardeando con mensajes muy rápido. Denme unos 40 segunditos para recuperarme.');
                }
            }
        }
    }
};
