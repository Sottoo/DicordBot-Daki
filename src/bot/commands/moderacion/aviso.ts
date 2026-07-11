import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, TextChannel, MessageFlags, ChannelType } from 'discord.js';

// Límites de Discord para embeds
const MAX_TITLE = 256;
const MAX_DESCRIPTION = 4096;

export default {
    data: new SlashCommandBuilder()
        .setName('aviso')
        .setDescription('Envía un aviso oficial al servidor como Daki bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Solo Admins
        .addStringOption(option =>
            option.setName('mensaje')
                .setDescription('El mensaje que deseas anunciar')
                .setMaxLength(MAX_DESCRIPTION)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('titulo')
                .setDescription('El título del aviso (opcional)')
                .setMaxLength(MAX_TITLE)
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal donde se enviará el aviso')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const mensaje = interaction.options.getString('mensaje', true);
        const titulo = interaction.options.getString('titulo') || '📢 Aviso Oficial';

        // Resolvemos el canal destino y validamos que se pueda enviar en él.
        const canalOpcion = interaction.options.getChannel('canal');
        const canal = (canalOpcion ?? interaction.channel);

        if (!canal || !('send' in canal)) {
            await interaction.editReply('❌ No encontré un canal de texto válido donde enviar el aviso.');
            return;
        }

        // Aunque las opciones ya limitan la longitud, validamos defensivamente
        // por si el título por defecto u otros cambios excedieran los límites.
        if (titulo.length > MAX_TITLE || mensaje.length > MAX_DESCRIPTION) {
            await interaction.editReply(`❌ El título no puede superar ${MAX_TITLE} caracteres ni el mensaje ${MAX_DESCRIPTION}.`);
            return;
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Administración del Servidor', iconURL: interaction.client.user?.displayAvatarURL() })
            .setTitle(titulo)
            .setDescription(mensaje)
            .setColor('#5B8CFF')
            .setThumbnail(interaction.guild?.iconURL() || null)
            .setFooter({ text: 'Notificación del Sistema Daki', iconURL: interaction.guild?.iconURL() || undefined })
            .setTimestamp();

        try {
            await (canal as TextChannel).send({ embeds: [embed] });
            await interaction.editReply('✅ Aviso enviado correctamente.');
        } catch (error) {
            console.error('Error enviando aviso:', error);
            await interaction.editReply('❌ No pude enviar el aviso. Revisa que tenga permisos para escribir en ese canal.');
        }
    }
};
