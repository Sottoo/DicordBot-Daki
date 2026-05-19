import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setLevelRole, getLevelRoles } from '../../utils/db.js';

export default {
    data: new SlashCommandBuilder()
        .setName('recompensa')
        .setDescription('Configura qué rol se le dará automáticamente a un usuario al alcanzar cierto nivel (Solo Admins).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option => 
            option.setName('nivel')
                .setDescription('El nivel que el usuario debe alcanzar para ganar el rol.')
                .setRequired(true)
        )
        .addRoleOption(option => 
            option.setName('rol')
                .setDescription('El rol que ganarán (Déjalo en blanco para ver qué rol está configurado actualmente)')
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const nivel = interaction.options.getInteger('nivel', true);
        const rol = interaction.options.getRole('rol', false);

        if (!rol) {
            // Modo "Ver" recompensa
            const rolesMap = getLevelRoles();
            const existingRoleId = rolesMap[nivel.toString()];
            
            if (existingRoleId) {
                await interaction.editReply(`Para el **Nivel ${nivel}**, la recompensa actual es el rol: <@&${existingRoleId}>.`);
            } else {
                await interaction.editReply(`❌ No hay ninguna recompensa configurada para el **Nivel ${nivel}**.`);
            }
            return;
        }

        // Modo "Guardar" recompensa
        setLevelRole(nivel, rol.id);

        await interaction.editReply(`✅ **¡Recompensa guardada!**\nA partir de ahora, cuando un usuario llegue al **Nivel ${nivel}**, recibirá automáticamente el rol <@&${rol.id}>.`);
    }
};
