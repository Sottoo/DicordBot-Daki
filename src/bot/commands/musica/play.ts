import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, MessageFlags } from 'discord.js';
import { useMainPlayer } from 'discord-player';

export default {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Reproduce una canción o playlist en tu canal de voz.')
        .addStringOption(option =>
            option.setName('cancion')
                .setDescription('El nombre de la canción o el enlace (URL)')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const player = useMainPlayer();
        const query = interaction.options.getString('cancion', true);
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: '❌ ¡Debes estar en un canal de voz para reproducir música!', flags: MessageFlags.Ephemeral });
            return;
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user!);
        if (!permissions?.has('Connect') || !permissions?.has('Speak')) {
            await interaction.reply({ content: '❌ ¡No tengo permisos para unirme o hablar en tu canal de voz!', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply();

        try {
            const { track } = await player.play(voiceChannel as any, query, {
                searchEngine: 'youtube',
                nodeOptions: {
                    metadata: interaction,
                    leaveOnEmpty: true,
                    leaveOnEmptyCooldown: 300000, // 5 min
                    leaveOnEnd: false, // Don't leave when queue ends
                }
            });

            await interaction.followUp(`🎶 ¡Reproduciendo **${track.title}** en ${voiceChannel.name}!`);
        } catch (error) {
            console.error('Error al reproducir:', error);
            await interaction.followUp('❌ Hubo un error al intentar reproducir la canción. Puede que no la haya encontrado o sea una fuente no soportada.');
        }
    }
};
