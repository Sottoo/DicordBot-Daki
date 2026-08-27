import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { aplicarLockdown } from '../../services/antiRaid.js';
import { getConfig } from '../../utils/guardConfig.js';

export default {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Botón de pánico: cierra o reabre todos los canales del servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o =>
            o.setName('accion')
                .setDescription('Cerrar el servidor o volver a abrirlo')
                .addChoices(
                    { name: '🛑 Activar — nadie puede escribir', value: 'activar' },
                    { name: '🔓 Desactivar — restaurar permisos anteriores', value: 'desactivar' },
                )
                .setRequired(true))
        .addStringOption(o =>
            o.setName('motivo')
                .setDescription('Motivo (queda en el registro de auditoría de Discord)')
                .setMaxLength(400)
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('Este comando solo funciona dentro de un servidor.');
            return;
        }

        const activar = interaction.options.getString('accion', true) === 'activar';
        const motivo = interaction.options.getString('motivo') || `Solicitado por ${interaction.user.tag}`;
        const cfg = getConfig();

        if (activar && cfg.lockdown.activo) {
            await interaction.editReply('⚠️ El servidor ya está cerrado. Usa `/lockdown accion:desactivar` para reabrirlo.');
            return;
        }
        if (!activar && !cfg.lockdown.activo) {
            await interaction.editReply('⚠️ El servidor no está cerrado ahora mismo.');
            return;
        }

        const { cambiados, fallidos } = await aplicarLockdown(guild, activar, motivo);

        const embed = new EmbedBuilder()
            .setColor(activar ? '#FF0000' : '#22C55E')
            .setTitle(activar ? '🛑 SERVIDOR CERRADO' : '🔓 Servidor reabierto')
            .setDescription(
                activar
                    ? `Nadie puede escribir ni reaccionar hasta que se reabra.\n**Motivo:** ${motivo}`
                    : `Se restauraron los permisos que había antes del cierre.\n**Motivo:** ${motivo}`
            )
            .addFields({ name: 'Canales modificados', value: `${cambiados}`, inline: true })
            .setFooter({ text: 'Guardián de Daki' })
            .setTimestamp();

        if (fallidos.length) {
            embed.addFields({
                name: `⚠️ No pude modificar ${fallidos.length}`,
                value: fallidos.slice(0, 8).join('\n').slice(0, 1024),
                inline: false,
            });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
