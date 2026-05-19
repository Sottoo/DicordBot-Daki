import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Muestra la lista de comandos disponibles que puedes usar.'),

    async execute(interaction: ChatInputCommandInteraction) {
        // Embed para usuarios normales (Los comandos de Administrador no se muestran, y de hecho Discord los oculta automáticamente)
        const embed = new EmbedBuilder()
            .setColor('#121212') // Gris oscuro profesional
            .setTitle('🤖 Comandos de Daki Bot')
            .setDescription('Aquí tienes la lista de comandos que puedes utilizar para interactuar conmigo y con el servidor:\n')
            .addFields(
                { name: '⭐ Nivel y Experiencia', value: '`/rank [usuario]`\nGenera una tarjeta visual increíble con tu nivel actual, experiencia y barra de progreso.\n\n`/leaderboard`\nMuestra el top 10 de los usuarios más activos de todo el servidor.' },
                { name: '🧠 Inteligencia Artificial', value: '`/preguntar <pregunta>`\nHazme cualquier pregunta y te responderé con mi inteligencia artificial avanzada.\n*(Nota: También puedes mencionarme directamente en los canales de IA para hablar conmigo).*' }
            )
            .setFooter({ text: 'Los comandos de moderación y configuración están restringidos automáticamente por Discord.' });

        await interaction.reply({ embeds: [embed] });
    }
};
