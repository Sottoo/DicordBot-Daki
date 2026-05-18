import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, MessageFlags } from 'discord.js';
import { useQueue } from 'discord-player';

export default {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Detiene la música y vacía la cola de reproducción.'),

    async execute(interaction: ChatInputCommandInteraction) {
        const queue = useQueue(interaction.guildId!);
        const member = interaction.member as GuildMember;

        if (!member.voice.channel) {
            await interaction.reply({ content: '❌ ¡Debes estar en un canal de voz para detener la música!', flags: MessageFlags.Ephemeral });
            return;
        }

        if (!queue || !queue.isPlaying()) {
            await interaction.reply({ content: '❌ No hay música reproduciéndose en este momento.', flags: MessageFlags.Ephemeral });
            return;
        }

        queue.delete();
        await interaction.reply('⏹️ La música ha sido detenida y la cola se ha vaciado.');
    }
};
