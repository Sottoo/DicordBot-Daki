import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { estadoIntents } from '../../index.js';
import { getConfig } from '../../utils/guardConfig.js';

const PERMISOS_CLAVE = [
    { flag: PermissionFlagsBits.ManageMessages, nombre: 'Gestionar mensajes', para: 'borrar los enlaces del atacante', vital: true },
    { flag: PermissionFlagsBits.ModerateMembers, nombre: 'Aislar miembros (timeout)', para: 'silenciar al atacante', vital: true },
    { flag: PermissionFlagsBits.KickMembers, nombre: 'Expulsar miembros', para: 'sanción media', vital: false },
    { flag: PermissionFlagsBits.BanMembers, nombre: 'Banear miembros', para: 'sanción máxima', vital: false },
    { flag: PermissionFlagsBits.ManageChannels, nombre: 'Gestionar canales', para: 'cerrar el servidor (/lockdown)', vital: true },
    { flag: PermissionFlagsBits.ManageGuild, nombre: 'Gestionar servidor', para: 'crear reglas de AutoMod', vital: true },
    { flag: PermissionFlagsBits.ViewAuditLog, nombre: 'Ver registro de auditoría', para: 'saber quién hizo qué', vital: false },
    { flag: PermissionFlagsBits.ReadMessageHistory, nombre: 'Ver historial', para: 'purgar mensajes antiguos', vital: true },
];

export default {
    data: new SlashCommandBuilder()
        .setName('diagnostico')
        .setDescription('Revisa si el bot REALMENTE puede defender el servidor (intents, permisos, canales).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addBooleanOption(o =>
            o.setName('publico')
                .setDescription('Mostrar el resultado a todo el canal (por defecto: solo para ti)')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const publico = interaction.options.getBoolean('publico') ?? false;
        await interaction.deferReply(publico ? {} : { flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('Este comando solo funciona dentro de un servidor.');
            return;
        }

        const yo = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
        if (!yo) {
            await interaction.editReply('❌ No pude obtener mi propio miembro en este servidor.');
            return;
        }

        const problemas: string[] = [];

        // ── 1. Intents ───────────────────────────────────────────────────────
        const intentOk = estadoIntents.messageContent;
        if (!intentOk) {
            problemas.push('**El bot NO puede leer el texto de los mensajes.** Es la falla más grave: sin esto no detecta ni un solo enlace.');
        }

        // ── 2. Permisos globales ─────────────────────────────────────────────
        const permisosTexto = PERMISOS_CLAVE.map(p => {
            const tiene = yo.permissions.has(p.flag);
            if (!tiene && p.vital) problemas.push(`Falta el permiso **${p.nombre}** (necesario para ${p.para}).`);
            return `${tiene ? '✅' : (p.vital ? '❌' : '⚠️')} ${p.nombre}`;
        }).join('\n');

        // ── 3. Jerarquía de roles ────────────────────────────────────────────
        const miPosicion = yo.roles.highest.position;
        const rolesEncima = guild.roles.cache
            .filter(r => r.position > miPosicion && !r.managed && r.id !== guild.roles.everyone.id)
            .sort((a, b) => b.position - a.position);

        const jerarquiaTexto = rolesEncima.size === 0
            ? `✅ Mi rol (**${yo.roles.highest.name}**) está por encima de todos. Puedo sancionar a cualquiera.`
            : `⚠️ Hay **${rolesEncima.size} roles por encima** del mío (**${yo.roles.highest.name}**):\n` +
              rolesEncima.first(8)!.map(r => `• ${r.name}`).join('\n') +
              `\n\n**No puedo sancionar a nadie que tenga esos roles.** Sube mi rol en Ajustes → Roles.`;

        if (rolesEncima.size > 0) {
            problemas.push(`Mi rol está por debajo de ${rolesEncima.size} rol(es): si hackean una cuenta con esos roles, **no la puedo tocar**.`);
        }

        // ── 4. Canales donde el bot está ciego o atado ───────────────────────
        const canales = (await guild.channels.fetch().catch(() => null)) ?? guild.channels.cache;
        const sinVer: string[] = [];
        const sinBorrar: string[] = [];
        let totalTexto = 0;

        for (const canal of canales.values()) {
            if (!canal || !canal.isTextBased()) continue;
            totalTexto++;
            const perms = canal.permissionsFor(yo);
            if (!perms?.has(PermissionFlagsBits.ViewChannel)) {
                sinVer.push(`<#${canal.id}>`);
                continue;
            }
            if (!perms.has(PermissionFlagsBits.ManageMessages)) {
                sinBorrar.push(`<#${canal.id}>`);
            }
        }

        if (sinVer.length) problemas.push(`Hay **${sinVer.length} canales de texto que el bot no ve**: ahí un atacante puede escribir libremente.`);
        if (sinBorrar.length) problemas.push(`Hay **${sinBorrar.length} canales donde el bot ve pero NO puede borrar**. Esto explica el "no bloqueó nada".`);

        const canalesTexto =
            `Canales de texto revisados: **${totalTexto}** (incluye los chats de canales de voz e hilos)\n` +
            (sinVer.length ? `\n❌ **No los veo (${sinVer.length}):** ${sinVer.slice(0, 12).join(' ')}${sinVer.length > 12 ? ' …' : ''}` : '\n✅ Veo todos los canales de texto') +
            (sinBorrar.length ? `\n❌ **No puedo borrar en (${sinBorrar.length}):** ${sinBorrar.slice(0, 12).join(' ')}${sinBorrar.length > 12 ? ' …' : ''}` : '\n✅ Puedo borrar en todos los que veo');

        // ── 5. Configuración del guardián ────────────────────────────────────
        const cfg = getConfig();
        if (!cfg.activo) problemas.push('El guardián está **DESACTIVADO** (`/guardian activo:true`).');
        if (!cfg.canalLogsId) problemas.push('No hay **canal de logs**: los incidentes no quedan registrados en ninguna parte (`/guardian`).');

        const configTexto =
            `${cfg.activo ? '✅' : '❌'} Guardián: **${cfg.activo ? 'activo' : 'DESACTIVADO'}**\n` +
            `${cfg.canalLogsId ? '✅' : '❌'} Canal de logs: ${cfg.canalLogsId ? `<#${cfg.canalLogsId}>` : '**sin configurar**'}\n` +
            `${cfg.canalAlertasId ? '✅' : '⚠️'} Canal de alertas: ${cfg.canalAlertasId ? `<#${cfg.canalAlertasId}>` : 'usa el de logs'}\n` +
            `${cfg.rolAlertaId ? '✅' : '⚠️'} Rol de mods a avisar: ${cfg.rolAlertaId ? `<@&${cfg.rolAlertaId}>` : 'sin configurar'}\n` +
            `🔧 Sanción máxima automática: **${cfg.sancionMaxima}**\n` +
            `${cfg.autoLockdown ? '✅' : '⚠️'} Cierre automático en raid: **${cfg.autoLockdown ? 'sí' : 'no'}**\n` +
            `${cfg.lockdown.activo ? '🛑 **EL SERVIDOR ESTÁ CERRADO AHORA MISMO** — usa /lockdown accion:desactivar' : '🔓 Servidor abierto'}`;

        // ── 6. AutoMod nativo de Discord ─────────────────────────────────────
        let automodTexto: string;
        try {
            const reglas = await guild.autoModerationRules.fetch();
            const mias = reglas.filter(r => r.name.startsWith('Daki'));
            if (mias.size === 0) {
                automodTexto = '❌ **Sin reglas de AutoMod.** Esta capa bloquea los enlaces del lado de Discord, incluso si el bot está caído o sin intents. Ejecuta `/setup-automod`.';
                problemas.push('No hay **AutoMod nativo**. Es la única defensa que funciona aunque el bot esté offline (`/setup-automod`).');
            } else {
                automodTexto = `✅ **${mias.size} reglas activas:**\n` + mias.map(r => `• ${r.name} ${r.enabled ? '' : '(desactivada)'}`).join('\n');
            }
        } catch {
            automodTexto = '⚠️ No pude leer las reglas de AutoMod (me falta *Gestionar servidor*).';
        }

        // ── Resultado ────────────────────────────────────────────────────────
        const sano = problemas.length === 0;
        const embed = new EmbedBuilder()
            .setColor(sano ? '#22C55E' : (intentOk ? '#FF6600' : '#FF0000'))
            .setTitle(sano ? '🛡️ Diagnóstico: TODO EN ORDEN' : `🩺 Diagnóstico: ${problemas.length} problema(s) detectado(s)`)
            .setDescription(
                sano
                    ? 'El guardián puede leer, borrar y sancionar en todo el servidor.'
                    : '**Esto es lo que hay que arreglar, en orden de importancia:**\n' +
                      problemas.map((p, i) => `**${i + 1}.** ${p}`).join('\n')
            )
            .addFields(
                {
                    name: '📡 Lectura de mensajes (intent)',
                    value: intentOk
                        ? '✅ **Activo.** El bot lee el contenido de los mensajes.'
                        : `❌ **INACTIVO** — ${estadoIntents.motivoFallo || 'desconocido'}\n` +
                          'Ve a *discord.com/developers/applications → tu app → Bot* y activa **MESSAGE CONTENT INTENT**. Luego reinicia el bot.',
                    inline: false,
                },
                { name: '🔑 Permisos del bot', value: permisosTexto, inline: false },
                { name: '📊 Jerarquía de roles', value: jerarquiaTexto.slice(0, 1024), inline: false },
                { name: '#️⃣ Cobertura de canales', value: canalesTexto.slice(0, 1024), inline: false },
                { name: '⚙️ Configuración del guardián', value: configTexto.slice(0, 1024), inline: false },
                { name: '🤖 AutoMod de Discord', value: automodTexto.slice(0, 1024), inline: false },
            )
            .setFooter({ text: 'Guardián de Daki · /diagnostico' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
