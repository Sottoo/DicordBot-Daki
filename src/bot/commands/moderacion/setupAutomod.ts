import {
    AutoModerationActionType,
    AutoModerationRuleEventType,
    AutoModerationRuleTriggerType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';

/**
 * AutoMod es el filtro nativo de Discord: bloquea el mensaje ANTES de publicarlo,
 * del lado del servidor. Funciona aunque el bot esté apagado, sin intents o
 * caído por un deploy — que es exactamente lo que hace falta contra un raid.
 */

// AutoMod usa el motor de regex de Rust: no admite lookahead/lookbehind.
const REGEX_INVITES = [
    '(?i)(discord|discordapp)\\s*\\.\\s*(gg|com/invite|me)\\s*/\\s*[a-zA-Z0-9_-]{2,}',
    '(?i)(dsc|invite)\\s*\\.\\s*gg\\s*/\\s*[a-zA-Z0-9_-]{2,}',
];

const REGEX_ESTAFA = [
    '(?i)(dlscord|discrod|disc0rd|discorcl|dilscord|dlscordapp)',
    '(?i)discord\\s*[-.]?\\s*(nitro|gift)\\s*[-.]?\\s*(free|gratis|claim|drop)',
    '(?i)(steancommunity|steamcomunity|stearncommunity|steamcommunity\\s*\\.\\s*ru)',
    '(?i)(grabify|iplogger|blasze|ipgrabber|yip\\s*\\.\\s*su|2no\\s*\\.\\s*co)',
    '(?i)(bit\\s*\\.\\s*ly|tinyurl|cutt\\s*\\.\\s*ly|rb\\s*\\.\\s*gy|adf\\s*\\.\\s*ly|linkvertise|shorte\\s*\\.\\s*st)\\s*/',
    '(?i)(free|gratis)\\s*(nitro|robux|vbucks|steam\\s*gift)',
    '(?i)(nitro|robux)\\s*(gratis|free)',
];

// Solo en modo estricto: cualquier enlace http(s) o dominio con TLD conocido.
const REGEX_ENLACES = [
    '(?i)https?\\s*:\\s*/\\s*/',
    '(?i)\\bwww\\s*\\.\\s*[a-z0-9-]{2,}',
    '(?i)\\b[a-z0-9-]{2,63}\\s*\\.\\s*(com|net|org|gg|io|xyz|top|ru|link|click|shop|online|site|info|tv|cc|app|live|store|club|fun|vip|lol|gift|pw|su|biz|icu)\\b',
];

/** Dominios que AutoMod dejará pasar aunque coincidan con los patrones. */
const LISTA_BLANCA = [
    '*tenor.com*', '*giphy.com*',
    '*cdn.discordapp.com*', '*media.discordapp.net*', '*images-ext-1.discordapp.net*', '*images-ext-2.discordapp.net*',
    '*tiktok.com*', '*youtube.com/watch*', '*youtu.be*', '*open.spotify.com*',
];

const PALABRAS_ESTAFA = [
    '*nitro gratis*', '*free nitro*', '*regalo de nitro*', '*claim your nitro*',
    '*steam gift*', '*regalo de steam*', '*free steam*',
    '*nudes gratis*', '*packs gratis*', '*leaked nudes*',
    '*verifica tu cuenta*', '*verify your account*',
    '*crypto giveaway*', '*free airdrop*',
];

export default {
    data: new SlashCommandBuilder()
        .setName('setup-automod')
        .setDescription('Crea las reglas de AutoMod de Discord (protección que funciona aunque el bot esté caído).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o =>
            o.setName('nivel')
                .setDescription('Qué tan agresivo debe ser el filtro')
                .addChoices(
                    { name: 'Equilibrado — bloquea invites, estafas y spam (recomendado)', value: 'equilibrado' },
                    { name: 'Estricto — bloquea además CUALQUIER enlace externo', value: 'estricto' },
                )
                .setRequired(true))
        .addChannelOption(o =>
            o.setName('canal_alertas')
                .setDescription('Canal donde AutoMod avisará de cada bloqueo')
                .setRequired(false))
        .addRoleOption(o =>
            o.setName('rol_exento')
                .setDescription('Rol que puede enviar enlaces libremente (staff)')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('Este comando solo funciona dentro de un servidor.');
            return;
        }

        const yo = guild.members.me;
        if (!yo?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.editReply('❌ Me falta el permiso **Gestionar servidor**, que Discord exige para crear reglas de AutoMod.');
            return;
        }

        const nivel = interaction.options.getString('nivel', true);
        const canalAlertas = interaction.options.getChannel('canal_alertas');
        const rolExento = interaction.options.getRole('rol_exento');

        const exemptRoles = rolExento ? [rolExento.id] : [];
        const accionesBase: any[] = [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: 'Bloqueado por el Guardián de Daki: enlaces y estafas no están permitidos.' } }];
        if (canalAlertas) accionesBase.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channel: canalAlertas.id } });

        const creadas: string[] = [];
        const fallidas: string[] = [];

        // Borramos nuestras reglas anteriores para que el comando sea repetible
        // sin acumular duplicados (Discord solo permite 6 reglas de tipo Keyword).
        try {
            const existentes = await guild.autoModerationRules.fetch();
            for (const regla of existentes.values()) {
                if (regla.name.startsWith('Daki')) {
                    await regla.delete('Recreando reglas con /setup-automod').catch(() => null);
                }
            }
        } catch {
            // Sin reglas previas o sin acceso: seguimos.
        }

        const plan: { nombre: string; opciones: any }[] = [
            {
                nombre: 'Daki · Invitaciones a otros servidores',
                opciones: {
                    name: 'Daki · Invitaciones a otros servidores',
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: AutoModerationRuleTriggerType.Keyword,
                    triggerMetadata: { regexPatterns: REGEX_INVITES, keywordFilter: [], allowList: LISTA_BLANCA },
                    actions: [...accionesBase, { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 3600 } }],
                    enabled: true,
                    exemptRoles,
                },
            },
            {
                nombre: 'Daki · Estafas y phishing',
                opciones: {
                    name: 'Daki · Estafas y phishing',
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: AutoModerationRuleTriggerType.Keyword,
                    triggerMetadata: { regexPatterns: REGEX_ESTAFA, keywordFilter: PALABRAS_ESTAFA, allowList: LISTA_BLANCA },
                    // 24 h: si una cuenta comprometida empieza a repartir phishing,
                    // se queda callada hasta que un humano revise.
                    actions: [...accionesBase, { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 86400 } }],
                    enabled: true,
                    exemptRoles: [],  // ni el staff debería mandar phishing
                },
            },
            {
                nombre: 'Daki · Menciones masivas',
                opciones: {
                    name: 'Daki · Menciones masivas',
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: AutoModerationRuleTriggerType.MentionSpam,
                    triggerMetadata: { mentionTotalLimit: 6, mentionRaidProtectionEnabled: true },
                    actions: [...accionesBase, { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 3600 } }],
                    enabled: true,
                    exemptRoles,
                },
            },
            {
                nombre: 'Daki · Spam y contenido masivo',
                opciones: {
                    name: 'Daki · Spam y contenido masivo',
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: AutoModerationRuleTriggerType.Spam,
                    triggerMetadata: {},
                    // El trigger Spam no admite acción de Timeout en la API de Discord.
                    actions: accionesBase,
                    enabled: true,
                    exemptRoles,
                },
            },
        ];

        if (nivel === 'estricto') {
            plan.push({
                nombre: 'Daki · Cualquier enlace externo',
                opciones: {
                    name: 'Daki · Cualquier enlace externo',
                    eventType: AutoModerationRuleEventType.MessageSend,
                    triggerType: AutoModerationRuleTriggerType.Keyword,
                    triggerMetadata: { regexPatterns: REGEX_ENLACES, keywordFilter: [], allowList: LISTA_BLANCA },
                    actions: accionesBase,   // solo bloquear: un enlace suelto no merece mute
                    enabled: true,
                    exemptRoles,
                },
            });
        }

        for (const { nombre, opciones } of plan) {
            try {
                await guild.autoModerationRules.create({ ...opciones, reason: `Configurado con /setup-automod por ${interaction.user.tag}` });
                creadas.push(nombre);
            } catch (e: any) {
                fallidas.push(`${nombre} → \`${e?.message ?? e}\``);
            }
        }

        const embed = new EmbedBuilder()
            .setColor(fallidas.length ? '#FF6600' : '#22C55E')
            .setTitle('🤖 AutoMod de Discord configurado')
            .setDescription(
                'Estas reglas viven en **Discord**, no en el bot. Bloquean el mensaje antes de que se publique, ' +
                'y siguen funcionando si el bot se cae, se reinicia o pierde permisos.\n\n' +
                `**Nivel:** ${nivel}` +
                (rolExento ? `\n**Rol exento:** ${rolExento}` : '') +
                (canalAlertas ? `\n**Alertas en:** ${canalAlertas}` : '\n⚠️ Sin canal de alertas: no verás los bloqueos en Discord.')
            )
            .addFields(
                { name: `✅ Reglas creadas (${creadas.length})`, value: creadas.map(c => `• ${c}`).join('\n') || '—', inline: false },
            )
            .setFooter({ text: 'Puedes verlas y ajustarlas en Ajustes del servidor → AutoMod' });

        if (fallidas.length) {
            embed.addFields({ name: `❌ Fallidas (${fallidas.length})`, value: fallidas.join('\n').slice(0, 1024), inline: false });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
