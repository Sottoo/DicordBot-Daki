import { Events, Message, EmbedBuilder } from 'discord.js';
import { CustomClient } from '../index.js';

const userMessages = new Map<string, { count: number; timer: NodeJS.Timeout }>();
const LIMIT = 5; // messages
const TIME = 5000; // 5 seconds

export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: CustomClient) {
        if (message.author.bot) return;

        // 1. ANTI-LINKS
        const linkRegex = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+)/gi;
        if (linkRegex.test(message.content)) {
            if (message.member && !message.member.permissions.has('ManageMessages')) {
                try {
                    await message.delete();
                    if (message.channel.isTextBased() && 'send' in message.channel) {
                        const embed = new EmbedBuilder()
                            .setColor('#FFCC00')
                            .setDescription(`⚠️ **¡Alto ahí, ${message.author}!**\nNo está permitido enviar enlaces externos en este servidor.`)
                            .setFooter({ text: 'Sistema de Seguridad Daki' });
                        await message.channel.send({ embeds: [embed] });
                    }
                } catch (e) {
                    console.error("Failed to delete message or send warning for link:", e);
                }
                return;
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
