import { Events, Message, EmbedBuilder } from 'discord.js';
import { CustomClient } from '../index.js';

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
                }
            }
        }
    }
};
