import { ChannelType, ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, User } from 'discord.js';
import { createWelcomeCard } from '../../utils/welcomeCard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('bienvenida')
        .setDescription('Genera una bienvenida de prueba para cualquier usuario.')
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
            await interaction.reply({ content: '❌ No encontré un canal válido para enviar la bienvenida.', ephemeral: true });
            return;
        }

        const sendableChannel = targetChannel as TextChannel;

        try {
            const attachment = await createWelcomeCard(interaction.guild!, targetUser, targetUser.displayName ?? targetUser.username);
            await sendableChannel.send({ content: `¡Bienvenido al servidor de Daki, ${targetUser}!`, files: [attachment] });
            await interaction.reply({ content: '✅ Bienvenida enviada correctamente.', ephemeral: true });
        } catch (error) {
            console.error('Error sending welcome test:', error);
            await interaction.reply({ content: '❌ No pude generar la bienvenida de prueba.', ephemeral: true });
        }
    }
};