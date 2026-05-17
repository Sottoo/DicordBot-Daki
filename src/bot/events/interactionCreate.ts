import { Events, BaseInteraction } from 'discord.js';
import { CustomClient } from '../index.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: BaseInteraction, client: CustomClient) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
            }
        }
    }
};
