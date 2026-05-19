import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setup-reglas')
        .setDescription('Despliega el panel de reglas con un botón de aceptación para los nuevos usuarios.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('rol_acceso')
                .setDescription('El rol que se dará al usuario cuando acepte las reglas.')
                .setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        const rolAcceso = interaction.options.getRole('rol_acceso', true);

        // Diseñamos el Embed de Reglas (Estilo Neo-Brutalista)
        const reglasEmbed = new EmbedBuilder()
            .setColor('#CCFF00') // Color vibrante neo-brutalista
            .setTitle('⚠️ REGLAS DEL SERVIDOR DE DAKI')
            .setDescription(
                '**¡Bienvenido a la comunidad!**\n' +
                'Para poder ver los demás canales y chatear, debes leer y aceptar estas reglas básicas:\n\n' +
                '**1.** No hacer spam, mandar links maliciosos o promocionar sin permiso.\n' +
                '**2.** Tratar a todos con respeto (¡pero aguantar la carrilla!).\n' +
                '**3.** No enviar contenido NSFW, gore o +18 (es ban instantáneo).\n' +
                '**4.** Usa el sentido común y pásala bien.\n\n' +
                'Si rompes alguna regla, Daki Bot te silenciará o te dará ban automático.\n\n' +
                '👉 **Haz clic en el botón de abajo para confirmar que leíste y aceptas las reglas.**'
            )
            .setFooter({ 
                text: 'Daki Stream Community', 
                iconURL: interaction.client.user?.displayAvatarURL() 
            })
            .setTimestamp();

        // Creamos el botón interactivo y guardamos la ID del rol en el customId
        // Así el bot sabrá qué rol dar sin necesidad de guardarlo en una base de datos.
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_rules_${rolAcceso.id}`)
                    .setLabel('✅ Acepto las reglas')
                    .setStyle(ButtonStyle.Success)
            );

        // Respondemos en privado para confirmar que se creó el panel
        await interaction.reply({ 
            content: 'Panel de reglas creado exitosamente.', 
            ephemeral: true 
        });

        // Enviamos el panel público al canal
        if (interaction.channel && 'send' in interaction.channel) {
            await interaction.channel.send({ 
                embeds: [reglasEmbed], 
                components: [row] 
            });
        }
    }
};
