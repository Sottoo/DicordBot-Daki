import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, MessageFlags } from 'discord.js';
import { useQueue } from 'discord-player';
import { getVoiceConnection } from '@discordjs/voice';

export default {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Saca al bot del canal de voz.'),

    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember;

        if (!member.voice.channel) {
            await interaction.reply({ content: '❌ ¡Debes estar en un canal de voz!', flags: MessageFlags.Ephemeral });
            return;
        }

        // Intentar destruir la cola si existe
        const queue = useQueue(interaction.guildId!);
        if (queue) {
            queue.delete();
        }

        // Forzar desconexión directa por si la cola no existía
        const connection = getVoiceConnection(interaction.guildId!);
        if (connection) {
            connection.destroy();
        }

        await interaction.reply('👋 ¡Me he desconectado del canal de voz!');
    }
};
