import { Events, GuildMember } from 'discord.js';
import { CustomClient } from '../index.js';
import { createWelcomeCard } from '../utils/welcomeCard.js';

export default {
    name: Events.GuildMemberAdd,
    async execute(member: GuildMember, client: CustomClient) {
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID; 
        if (!welcomeChannelId) {
            console.warn('WELCOME_CHANNEL_ID is not set. Welcome message will be skipped.');
            return;
        }

        console.log(`[WELCOME] Member joined: ${member.user.tag} -> ${welcomeChannelId}`);

        const channel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
        if (!channel || !channel.isTextBased() || !channel.isSendable()) {
            console.warn(`Welcome channel not found or not sendable: ${welcomeChannelId}`);
            return;
        }

        try {
            const attachment = await createWelcomeCard(member.guild, member.user, member.displayName);

            await channel.send({ content: `¡Bienvenido al servidor de Daki, ${member}!`, files: [attachment] });
        } catch (error) {
            console.error('Error generating welcome image:', error);
        }
    }
};
