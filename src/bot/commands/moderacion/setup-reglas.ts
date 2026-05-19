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

        // Diseñamos el Embed de Reglas (Estilo Neo-Brutalista Premium)
        const reglasEmbed = new EmbedBuilder()
            .setColor('#CCFF00') // Color vibrante neo-brutalista
            .setAuthor({ 
                name: 'COMUNIDAD OFICIAL DE DAKI', 
                iconURL: interaction.guild?.iconURL() || interaction.client.user?.displayAvatarURL() 
            })
            .setTitle('⚠️ REGLAS Y NORMAS DEL SERVIDOR ⚠️')
            .setDescription(
                'Bienvenido/a al cuartel general. Para mantener el servidor como un lugar entretenido, seguro y con buena vibra para los streams, es estrictamente necesario seguir estas reglas:\n\n' +
                '**1️⃣ ┃ Respeto y Convivencia**\n' +
                '> Puedes bromear y tirar carrilla sana, pero el respeto es fundamental. Cero tolerancia al racismo, homofobia, acoso o toxicidad extrema.\n\n' +
                '**2️⃣ ┃ Cero Spam / Auto-promoción**\n' +
                '> Está prohibido promocionar tus directos, redes sociales o servidores de Discord sin autorización previa. El flood o spam repetitivo será sancionado.\n\n' +
                '**3️⃣ ┃ Contenido Apropiado (SFW)**\n' +
                '> Totalmente prohibido el contenido NSFW (+18), material gráfico (gore) o cualquier enlace dudoso que viole las normas de Discord.\n\n' +
                '**4️⃣ ┃ Menciones y Pings (No molestar)**\n' +
                '> Evita etiquetar (@ping) a Daki o al equipo de Moderación de manera innecesaria. No exijas saludos ni hagas spam cuando el canal esté activo o en directo.\n\n' +
                '**5️⃣ ┃ Privacidad y Sentido Común**\n' +
                '> Está estrictamente prohibido compartir información personal, fotos de otros usuarios sin permiso o hacer "doxxeo". Usa tu sentido común.\n\n' +
                '---\n' +
                '🛡️ *El equipo de moderación se reserva el derecho de silenciar o banear a cualquier usuario que rompa la armonía del servidor.*\n\n' +
                '👇 **Haz clic en el botón verde para confirmar tu lectura, aceptar las reglas y desbloquear los canales.**'
            )
            .setFooter({ 
                text: 'Daki Stream Community • Sistema de Verificación', 
                iconURL: interaction.client.user?.displayAvatarURL() 
            });

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
