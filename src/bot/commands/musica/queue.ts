import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { useQueue } from 'discord-player';

export default {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Muestra la cola de reproducción actual.'),

    async execute(interaction: ChatInputCommandInteraction) {
        const queue = useQueue(interaction.guildId!);

        if (!queue || !queue.isPlaying()) {
            await interaction.reply({ content: '❌ No hay música reproduciéndose en este momento.', flags: MessageFlags.Ephemeral });
            return;
        }

        const currentTrack = queue.currentTrack;
        const tracks = queue.tracks.toArray();

        let queueString = tracks.slice(0, 10).map((t, i) => `${i + 1}. **${t.title}** - ${t.author}`).join('\n');
        if (tracks.length > 10) {
            queueString += `\n...y ${tracks.length - 10} canciones más.`;
        }

        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle(`🎶 Cola de reproducción en ${interaction.guild?.name}`)
            .setDescription(`**Reproduciendo ahora:**\n${currentTrack ? `[${currentTrack.title}](${currentTrack.url})` : 'Nada'}\n\n**Siguientes en la cola:**\n${queueString || 'No hay más canciones en la cola.'}`)
            .setFooter({ text: `Total de canciones en cola: ${tracks.length}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
