import { ChannelType, ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, User, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { createWelcomeCard } from '../../utils/welcomeCard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('bienvenida')
        .setDescription('Genera una bienvenida de prueba para cualquier usuario.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // Solo staff
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario para la tarjeta de bienvenida')
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal donde se enviará la bienvenida')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const targetUser = (interaction.options.getUser('usuario') ?? interaction.user) as User;
        const targetChannel = interaction.options.getChannel('canal') ?? interaction.channel;

        if (!targetChannel || !('send' in targetChannel)) {
            await interaction.reply({ content: '❌ No encontré un canal válido para enviar la bienvenida.', flags: MessageFlags.Ephemeral });
            return;
        }

        const sendableChannel = targetChannel as TextChannel;

        // Diferimos porque generar la tarjeta (descarga de avatar + render de canvas)
        // puede tardar más de 3s y la interacción expiraría ("Unknown interaction").
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const attachment = await createWelcomeCard(interaction.guild!, targetUser, targetUser.displayName ?? targetUser.username);
            await sendableChannel.send({ files: [attachment] });
            await interaction.editReply({ content: '✅ Bienvenida enviada correctamente.' });
        } catch (error) {
            console.error('Error sending welcome test:', error);
            await interaction.editReply({ content: '❌ No pude generar la bienvenida de prueba.' });
        }
    }
};