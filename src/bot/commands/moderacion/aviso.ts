import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, TextChannel } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('aviso')
        .setDescription('Envía un aviso oficial al servidor como Daki bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo Admins
        .addStringOption(option => 
            option.setName('mensaje')
                .setDescription('El mensaje que deseas anunciar')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal donde se enviará el aviso')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const mensaje = interaction.options.getString('mensaje');
        const canal = interaction.options.getChannel('canal') as TextChannel | null || interaction.channel as TextChannel;

        const embed = new EmbedBuilder()
            .setTitle('📢 Aviso Oficial')
            .setDescription(mensaje)
            .setColor('#ff4757')
            .setFooter({ text: 'Daki Bot Moderación', iconURL: interaction.client.user?.displayAvatarURL() })
            .setTimestamp();

        await canal.send({ embeds: [embed] });
        await interaction.reply({ content: '✅ Aviso enviado correctamente.', ephemeral: true });
    }
};
