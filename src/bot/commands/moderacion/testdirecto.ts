import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { buildLiveEmbed, buildLiveComponents, TIKTOK_USERNAME } from '../../services/tiktokLive.js';

export default {
    data: new SlashCommandBuilder()
        .setName('testdirecto')
        .setDescription('Previsualiza el aviso de directo de TikTok (solo tú lo verás).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        // Respuesta efímera: solo la ve quien ejecuta el comando. No se envía al
        // canal de avisos ni se menciona a nadie, es solo una vista previa.
        await interaction.reply({
            content: `🔎 **Vista previa del aviso de directo** (@${TIKTOK_USERNAME})\nAsí se verá el mensaje cuando Daki empiece un stream. En el aviso real se enviará al canal configurado y mencionará a @everyone.`,
            embeds: [buildLiveEmbed()],
            components: buildLiveComponents(),
            flags: MessageFlags.Ephemeral,
        });
    }
};
