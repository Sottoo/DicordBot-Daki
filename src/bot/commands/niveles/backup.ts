import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, MessageFlags } from 'discord.js';
import { getDBPath, flushDB } from '../../utils/db.js';
import { getConfigPath, flushConfig } from '../../utils/guardConfig.js';
import fs from 'fs';

export default {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Genera una copia de seguridad del XP y de la configuración del guardián (Solo Admins).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Volcamos a disco los cambios pendientes en memoria (ambos archivos
        // escriben con retardo) para que el backup no contenga una versión
        // anterior ni un JSON a medio escribir.
        await Promise.all([flushDB(), flushConfig()]);

        const rutaXP = getDBPath();
        const rutaGuardian = getConfigPath();

        const archivos: AttachmentBuilder[] = [];
        const incluidos: string[] = [];

        if (fs.existsSync(rutaXP)) {
            archivos.push(new AttachmentBuilder(rutaXP, { name: 'daki_xp_backup.json' }));
            incluidos.push('**XP y niveles** → `daki_xp_backup.json`');
        }

        if (fs.existsSync(rutaGuardian)) {
            archivos.push(new AttachmentBuilder(rutaGuardian, { name: 'daki_guardian_backup.json' }));
            incluidos.push('**Configuración del guardián** → `daki_guardian_backup.json`');
        }

        if (!archivos.length) {
            await interaction.editReply('❌ No hay nada que respaldar todavía: no existe ni la base de datos de XP ni la configuración del guardián.');
            return;
        }

        await interaction.editReply({
            content:
                '✅ **Copia de seguridad generada.**\n' +
                incluidos.map(l => `• ${l}`).join('\n') +
                '\n\nGuarda los dos archivos. Para restaurarlos, usa `/importar` con cada uno ' +
                '(el comando reconoce solo por el contenido cuál es cuál).' +
                (archivos.length === 1 ? '\n\n⚠️ Solo salió un archivo: el otro aún no existe en el disco.' : ''),
            files: archivos,
        });
    }
};
