import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import { getDBPath } from '../../utils/db.js';
import fs from 'fs';

export default {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Genera una copia de seguridad de la base de datos de Niveles y XP (Solo Admins).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const dbPath = getDBPath();

        if (!fs.existsSync(dbPath)) {
            await interaction.editReply('❌ No se encontró ninguna base de datos activa todavía.');
            return;
        }

        const attachment = new AttachmentBuilder(dbPath, { name: 'daki_xp_backup.json' });

        await interaction.editReply({
            content: '✅ **Copia de seguridad generada.**\nAquí tienes el archivo con toda la experiencia y niveles del servidor. Guárdalo bien. Si alguna vez necesitas restaurarlo, usa el comando `/importar`.',
            files: [attachment]
        });
    }
};
