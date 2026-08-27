import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { barrerUsuario, sancionar } from '../../services/antiRaid.js';
import { registrar, etiquetaUsuario } from '../../utils/modLog.js';

export default {
    data: new SlashCommandBuilder()
        .setName('limpiar-usuario')
        .setDescription('Borra los mensajes recientes de un usuario en TODOS los canales y lo sanciona.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(o =>
            o.setName('usuario')
                .setDescription('Quién dejó el desastre')
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName('minutos')
                .setDescription('Cuántos minutos hacia atrás limpiar (por defecto 60, máximo 20160 = 14 días)')
                .setMinValue(1)
                .setMaxValue(20160)
                .setRequired(false))
        .addStringOption(o =>
            o.setName('sancion')
                .setDescription('Qué hacer con el usuario además de limpiar')
                .addChoices(
                    { name: 'Nada — solo limpiar', value: 'nada' },
                    { name: 'Aislar 24 h (timeout)', value: 'timeout' },
                    { name: 'Expulsar', value: 'kick' },
                    { name: 'Banear', value: 'ban' },
                )
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('Este comando solo funciona dentro de un servidor.');
            return;
        }

        const usuario = interaction.options.getUser('usuario', true);
        const minutos = interaction.options.getInteger('minutos') ?? 60;
        const sancionPedida = interaction.options.getString('sancion') ?? 'nada';

        await interaction.editReply(`🧹 Barriendo los mensajes de **${usuario.tag}** de los últimos ${minutos} min en todos los canales… (puede tardar)`);

        // Primero sancionamos: así deja de escribir mientras limpiamos.
        let textoSancion = '— (ninguna)';
        if (sancionPedida !== 'nada') {
            const member = await guild.members.fetch(usuario.id).catch(() => null);
            if (!member) {
                textoSancion = '⚠️ Ya no está en el servidor.';
            } else if (sancionPedida === 'ban') {
                textoSancion = member.bannable
                    ? await member.ban({ reason: `Limpieza por ${interaction.user.tag}`, deleteMessageSeconds: 7 * 24 * 3600 }).then(() => '✅ baneado').catch(e => `❌ ${e.message}`)
                    : '❌ No puedo banearlo (jerarquía o permisos).';
            } else if (sancionPedida === 'kick') {
                textoSancion = member.kickable
                    ? await member.kick(`Limpieza por ${interaction.user.tag}`).then(() => '✅ expulsado').catch(e => `❌ ${e.message}`)
                    : '❌ No puedo expulsarlo (jerarquía o permisos).';
            } else {
                const res = await sancionar(member, `Limpieza por ${interaction.user.tag}`, 24 * 3600 * 1000);
                textoSancion = res.aplicada === 'ninguna' ? `❌ ${res.error}` : `✅ ${res.aplicada}`;
            }
        }

        const { borrados, canalesRevisados, sinPermiso } = await barrerUsuario(guild, usuario.id, minutos);

        const embed = new EmbedBuilder()
            .setColor(borrados > 0 ? '#22C55E' : '#FFCC00')
            .setTitle('🧹 Limpieza completada')
            .setDescription(`**Usuario:** ${etiquetaUsuario(usuario.id, usuario.tag)}`)
            .addFields(
                { name: 'Mensajes borrados', value: `${borrados}`, inline: true },
                { name: 'Canales revisados', value: `${canalesRevisados}`, inline: true },
                { name: 'Ventana', value: `${minutos} min`, inline: true },
                { name: 'Sanción', value: textoSancion, inline: false },
            )
            .setFooter({ text: 'Discord no permite borrar mensajes de más de 14 días en bloque.' });

        if (sinPermiso.length) {
            embed.addFields({
                name: `⚠️ Sin permiso para borrar en ${sinPermiso.length} canal(es)`,
                value: sinPermiso.slice(0, 10).join(' ').slice(0, 1024),
                inline: false,
            });
        }

        await interaction.editReply({ content: '', embeds: [embed] });

        await registrar(guild, {
            gravedad: 'info',
            titulo: 'Limpieza manual de usuario',
            descripcion: `**Moderador:** ${interaction.user.tag}\n**Objetivo:** ${etiquetaUsuario(usuario.id, usuario.tag)}\n**Borrados:** ${borrados} en ${canalesRevisados} canales (${minutos} min)\n**Sanción:** ${textoSancion}`,
        });
    }
};
