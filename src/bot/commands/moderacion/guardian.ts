import {
    ChannelType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { getConfig, setConfig, SancionMaxima } from '../../utils/guardConfig.js';

export default {
    data: new SlashCommandBuilder()
        .setName('guardian')
        .setDescription('Configura el sistema de defensa del servidor (anti-raid, logs, sanciones).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addBooleanOption(o =>
            o.setName('activo')
                .setDescription('Encender o apagar todo el sistema de defensa'))
        .addChannelOption(o =>
            o.setName('canal_logs')
                .setDescription('Canal donde se registra todo lo que hace el guardián')
                .addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o =>
            o.setName('canal_alertas')
                .setDescription('Canal donde se avisa de incidentes graves (si no, usa el de logs)')
                .addChannelTypes(ChannelType.GuildText))
        .addRoleOption(o =>
            o.setName('rol_alerta')
                .setDescription('Rol de moderación al que mencionar en incidentes graves'))
        .addStringOption(o =>
            o.setName('sancion_maxima')
                .setDescription('Hasta dónde puede llegar el bot por su cuenta')
                .addChoices(
                    { name: 'Timeout — solo silenciar (más seguro)', value: 'timeout' },
                    { name: 'Kick — expulsar en casos graves', value: 'kick' },
                    { name: 'Ban — banear y borrar 7 días de mensajes', value: 'ban' },
                ))
        .addBooleanOption(o =>
            o.setName('auto_lockdown')
                .setDescription('Cerrar el servidor automáticamente al detectar un raid'))
        .addRoleOption(o =>
            o.setName('rol_exento_add')
                .setDescription('Añadir un rol que pueda enviar enlaces libremente'))
        .addRoleOption(o =>
            o.setName('rol_exento_quitar')
                .setDescription('Quitar un rol de la lista de exentos'))
        .addChannelOption(o =>
            o.setName('canal_exento_add')
                .setDescription('Canal donde se permiten enlaces (ej. #comparte-tus-redes)'))
        .addChannelOption(o =>
            o.setName('canal_exento_quitar')
                .setDescription('Quitar un canal de la lista de exentos'))
        .addStringOption(o =>
            o.setName('dominio_add')
                .setDescription('Dominio a permitir siempre (ej. mitienda.com)'))
        .addStringOption(o =>
            o.setName('dominio_quitar')
                .setDescription('Dominio a quitar de la lista de permitidos')),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const cambios: string[] = [];
        const cfg = getConfig();

        const activo = interaction.options.getBoolean('activo');
        if (activo !== null) {
            setConfig({ activo });
            cambios.push(`Sistema: **${activo ? 'ACTIVADO' : 'DESACTIVADO'}**`);
        }

        const canalLogs = interaction.options.getChannel('canal_logs');
        if (canalLogs) {
            setConfig({ canalLogsId: canalLogs.id });
            cambios.push(`Canal de logs: ${canalLogs}`);
        }

        const canalAlertas = interaction.options.getChannel('canal_alertas');
        if (canalAlertas) {
            setConfig({ canalAlertasId: canalAlertas.id });
            cambios.push(`Canal de alertas: ${canalAlertas}`);
        }

        const rolAlerta = interaction.options.getRole('rol_alerta');
        if (rolAlerta) {
            setConfig({ rolAlertaId: rolAlerta.id });
            cambios.push(`Rol de alerta: ${rolAlerta}`);
        }

        const sancion = interaction.options.getString('sancion_maxima');
        if (sancion) {
            setConfig({ sancionMaxima: sancion as SancionMaxima });
            cambios.push(`Sanción máxima: **${sancion}**`);
        }

        const autoLockdown = interaction.options.getBoolean('auto_lockdown');
        if (autoLockdown !== null) {
            setConfig({ autoLockdown });
            cambios.push(`Cierre automático en raid: **${autoLockdown ? 'sí' : 'no'}**`);
        }

        const rolAdd = interaction.options.getRole('rol_exento_add');
        if (rolAdd && !cfg.rolesExentos.includes(rolAdd.id)) {
            setConfig({ rolesExentos: [...cfg.rolesExentos, rolAdd.id] });
            cambios.push(`Rol exento añadido: ${rolAdd}`);
        }

        const rolQuitar = interaction.options.getRole('rol_exento_quitar');
        if (rolQuitar) {
            setConfig({ rolesExentos: getConfig().rolesExentos.filter(r => r !== rolQuitar.id) });
            cambios.push(`Rol exento quitado: ${rolQuitar}`);
        }

        const canalAdd = interaction.options.getChannel('canal_exento_add');
        if (canalAdd && !cfg.canalesExentos.includes(canalAdd.id)) {
            setConfig({ canalesExentos: [...getConfig().canalesExentos, canalAdd.id] });
            cambios.push(`Canal exento añadido: ${canalAdd}`);
        }

        const canalQuitar = interaction.options.getChannel('canal_exento_quitar');
        if (canalQuitar) {
            setConfig({ canalesExentos: getConfig().canalesExentos.filter(c => c !== canalQuitar.id) });
            cambios.push(`Canal exento quitado: ${canalQuitar}`);
        }

        const dominioAdd = interaction.options.getString('dominio_add');
        if (dominioAdd) {
            const limpio = dominioAdd.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
            if (!getConfig().dominiosPermitidos.includes(limpio)) {
                setConfig({ dominiosPermitidos: [...getConfig().dominiosPermitidos, limpio] });
                cambios.push(`Dominio permitido: \`${limpio}\``);
            }
        }

        const dominioQuitar = interaction.options.getString('dominio_quitar');
        if (dominioQuitar) {
            const limpio = dominioQuitar.toLowerCase().trim();
            setConfig({ dominiosPermitidos: getConfig().dominiosPermitidos.filter(d => d !== limpio) });
            cambios.push(`Dominio quitado: \`${limpio}\``);
        }

        // Sin opciones = mostrar la configuración actual.
        const actual = getConfig();
        const embed = new EmbedBuilder()
            .setColor(actual.activo ? '#22C55E' : '#FF0000')
            .setTitle('🛡️ Configuración del Guardián')
            .setDescription(cambios.length ? `**Cambios aplicados:**\n${cambios.map(c => `• ${c}`).join('\n')}` : 'No indicaste ninguna opción. Esta es la configuración actual:')
            .addFields(
                { name: 'Estado', value: actual.activo ? '✅ Activo' : '❌ Desactivado', inline: true },
                { name: 'Sanción máxima', value: `\`${actual.sancionMaxima}\``, inline: true },
                { name: 'Auto-lockdown', value: actual.autoLockdown ? 'sí' : 'no', inline: true },
                { name: 'Canal de logs', value: actual.canalLogsId ? `<#${actual.canalLogsId}>` : '⚠️ sin configurar', inline: true },
                { name: 'Canal de alertas', value: actual.canalAlertasId ? `<#${actual.canalAlertasId}>` : '(usa el de logs)', inline: true },
                { name: 'Rol de alerta', value: actual.rolAlertaId ? `<@&${actual.rolAlertaId}>` : '⚠️ sin configurar', inline: true },
                { name: 'Roles exentos de enlaces', value: actual.rolesExentos.length ? actual.rolesExentos.map(r => `<@&${r}>`).join(' ') : '(solo admins)', inline: false },
                { name: 'Canales exentos', value: actual.canalesExentos.length ? actual.canalesExentos.map(c => `<#${c}>`).join(' ') : '(ninguno)', inline: false },
                { name: 'Dominios permitidos extra', value: actual.dominiosPermitidos.length ? actual.dominiosPermitidos.map(d => `\`${d}\``).join(', ') : '(solo la lista base: Tenor, Giphy, TikTok, YouTube…)', inline: false },
            )
            .setFooter({ text: 'Los admins y quien tenga "Gestionar servidor" siempre pueden enviar enlaces · usa /diagnostico para verificar permisos' });

        await interaction.editReply({ embeds: [embed] });
    }
};
