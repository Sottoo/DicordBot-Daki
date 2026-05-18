import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, MessageFlags } from 'discord.js';
import { useQueue } from 'discord-player';

export default {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Salta a la siguiente canción en la cola.'),

    async execute(interaction: ChatInputCommandInteraction) {
        const queue = useQueue(interaction.guildId!);
        const member = interaction.member as GuildMember;

        if (!member.voice.channel) {
            await interaction.reply({ content: '❌ ¡Debes estar en un canal de voz para saltar la música!', flags: MessageFlags.Ephemeral });
            return;
        }

        if (!queue || !queue.isPlaying()) {
            await interaction.reply({ content: '❌ No hay música reproduciéndose en este momento.', flags: MessageFlags.Ephemeral });
            return;
        }

        queue.node.skip();
        await interaction.reply('⏭️ Canción saltada.');
    }
};
