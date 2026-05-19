import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Muestra la lista de comandos disponibles que puedes usar.'),

    async execute(interaction: ChatInputCommandInteraction) {
        // Embed para usuarios normales (Los comandos de Administrador no se muestran, y de hecho Discord los oculta automáticamente)
        const embed = new EmbedBuilder()
            .setColor('#3B82F6') // Azul profesional para coincidir con la tarjeta y ranking
            .setTitle('💫 COMANDOS DE DAKI')
            .setDescription(
                'Aquí tienes los comandos disponibles ordenados por categorías:\n\n' +
                '🎮 **Niveles y Progreso**\n' +
                '• `/rank` - Genera tu tarjeta de nivel y progreso actual.\n' +
                '• `/leaderboard` - Muestra el ranking de usuarios más activos.\n\n' +
                '🧠 **Inteligencia Artificial**\n' +
                '• `/preguntar` - Chatea directamente conmigo usando la IA.\n' +
                '*(También puedes hablarme mencionándome en cualquier canal de IA).*'
            );

        await interaction.reply({ embeds: [embed] });
    }
};
