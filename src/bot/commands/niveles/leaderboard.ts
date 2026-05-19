import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard } from '../../utils/db.js';

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Muestra el top 10 de los usuarios más activos del servidor.'),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const topUsers = getLeaderboard(10);

        if (topUsers.length === 0) {
            await interaction.editReply('❌ Todavía no hay nadie en la tabla de clasificación. ¡Empiecen a chatear!');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#3B82F6')
            .setTitle('🏆 Tabla de Clasificación Global')
            .setDescription('Aquí están los usuarios más activos y con mayor nivel de experiencia de toda la comunidad.\n\n');

        let leaderboardText = '';
        const medallas = ['🥇', '🥈', '🥉'];

        for (let i = 0; i < topUsers.length; i++) {
            const user = topUsers[i];
            const rankEmoji = i < 3 ? medallas[i] : `**#${i + 1}**`;
            
            // Intentamos obtener el username usando menciones, o texto simple si no carga.
            leaderboardText += `${rankEmoji} <@${user.userId}>\n└ **Nivel ${user.level}** • ${Math.floor(user.xp)} XP\n\n`;
        }

        embed.setDescription(embed.data.description! + leaderboardText);
        embed.setFooter({ text: 'Sigue participando en el chat para subir en el ranking.' });

        await interaction.editReply({ embeds: [embed] });
    }
};
