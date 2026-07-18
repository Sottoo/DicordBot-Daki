import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { buildLiveEmbed, buildLiveComponents, fetchLiveInfo, TIKTOK_USERNAME } from '../../services/tiktokLive.js';

export default {
    data: new SlashCommandBuilder()
        .setName('testdirecto')
        .setDescription('Previsualiza el aviso de directo de TikTok (solo tú lo verás).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        // Respuesta efímera: solo la ve quien ejecuta el comando. No se envía al
        // canal de avisos ni se menciona a nadie, es solo una vista previa.
        // Diferimos porque obtener la portada del directo es una llamada de red.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Obtenemos la portada/info real del último room de TikTok para que la
        // vista previa se vea tal cual saldrá el aviso real.
        const info = await fetchLiveInfo();

        await interaction.editReply({
            content: `🔎 **Vista previa del aviso de directo** (@${TIKTOK_USERNAME})\nAsí se verá el mensaje cuando Daki empiece un stream. La imagen es la portada del directo (puede ser la del último stream si ahora no está en vivo). En el aviso real se enviará al canal configurado y mencionará a @everyone.`,
            embeds: [buildLiveEmbed(info)],
            components: buildLiveComponents(),
        });
    }
};
