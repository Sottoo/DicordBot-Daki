import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { importDB } from '../../utils/db.js';

export default {
    data: new SlashCommandBuilder()
        .setName('importar')
        .setDescription('Restaura la base de datos de Niveles subiendo un archivo de backup (Solo Admins).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addAttachmentOption(option => 
            option.setName('archivo')
                .setDescription('El archivo daki_xp_backup.json que generaste con /backup')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const attachment = interaction.options.getAttachment('archivo', true);

        if (!attachment.name.endsWith('.json')) {
            await interaction.editReply('❌ El archivo debe ser un `.json` válido.');
            return;
        }

        try {
            // Descargamos el archivo JSON usando fetch
            const response = await fetch(attachment.url);
            const data = await response.json();

            // Verificación básica para asegurar que tiene el formato correcto
            if (typeof data !== 'object' || Array.isArray(data)) {
                await interaction.editReply('❌ El formato del archivo no es válido.');
                return;
            }

            // Importamos los datos a nuestra BD en memoria y guardamos
            importDB(data);

            await interaction.editReply('✅ **¡Base de datos restaurada con éxito!**\nLos niveles y XP han vuelto a su estado anterior.');
            
        } catch (error) {
            console.error('Error importando DB:', error);
            await interaction.editReply('❌ Hubo un error al leer el archivo. Asegúrate de que no esté corrupto.');
        }
    }
};
