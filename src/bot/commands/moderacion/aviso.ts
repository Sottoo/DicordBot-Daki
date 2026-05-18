import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, TextChannel, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('aviso')
        .setDescription('Envía un aviso oficial al servidor como Daki bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo Admins
        .addStringOption(option => 
            option.setName('mensaje')
                .setDescription('El mensaje que deseas anunciar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('titulo')
                .setDescription('El título del aviso (opcional)')
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal donde se enviará el aviso')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const mensaje = interaction.options.getString('mensaje');
        const titulo = interaction.options.getString('titulo') || '📢 Aviso Oficial';
        const canal = interaction.options.getChannel('canal') as TextChannel | null || interaction.channel as TextChannel;

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Administración del Servidor', iconURL: interaction.client.user?.displayAvatarURL() })
            .setTitle(titulo)
            .setDescription(mensaje)
            .setColor('#5B8CFF') // Color azul/morado más elegante
            .setThumbnail(interaction.guild?.iconURL() || null)
            .setFooter({ text: 'Notificación del Sistema Daki', iconURL: interaction.guild?.iconURL() || undefined })
            .setTimestamp();

        await canal.send({ embeds: [embed] });
        await interaction.reply({ content: '✅ Aviso enviado correctamente.', flags: MessageFlags.Ephemeral });
    }
};
