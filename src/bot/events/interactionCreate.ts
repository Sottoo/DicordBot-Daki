import { Events, BaseInteraction, MessageFlags } from 'discord.js';
import { CustomClient } from '../index.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: BaseInteraction, client: CustomClient) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);
                // Protegemos el aviso de error: si la interacción ya expiró (10062/40060)
                // este reply/followUp lanzaría una unhandled rejection.
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'Hubo un error al ejecutar este comando.', flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', flags: MessageFlags.Ephemeral });
                    }
                } catch (replyError) {
                    console.error('No se pudo notificar el error al usuario:', replyError);
                }
            }
        } else if (interaction.isButton()) {
            // Manejo de botones
            const { customId } = interaction;

            // Verificamos si es el botón de aceptar reglas
            if (customId.startsWith('accept_rules_')) {
                const roleId = customId.replace('accept_rules_', '');

                // Usamos fetch en vez de la caché: si el miembro no está cacheado,
                // cache.get() devolvía undefined y daba un falso "no te encontré".
                let member;
                try {
                    member = await interaction.guild?.members.fetch(interaction.user.id);
                } catch {
                    member = undefined;
                }

                if (!member) {
                    await interaction.reply({ content: 'Hubo un error al encontrarte en el servidor.', flags: MessageFlags.Ephemeral }).catch(() => null);
                    return;
                }

                try {
                    // Otorgamos el rol
                    await member.roles.add(roleId);

                    // Respondemos con un mensaje efímero (invisible para los demás)
                    await interaction.reply({
                        content: '✅ **¡Reglas aceptadas!** Ahora tienes acceso al resto del servidor. ¡Bienvenido/a!',
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Error al dar el rol de reglas:', error);
                    await interaction.reply({
                        content: '❌ Hubo un error al darte el rol. Asegúrate de que mis permisos de rol estén por encima del rol que intento darte.',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => null);
                }
            }
        }
    }
};
