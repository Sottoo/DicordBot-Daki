import { Events, ActivityType } from 'discord.js';
import { CustomClient } from '../index.js';

export default {
    name: Events.ClientReady,
    once: true,
    execute(client: CustomClient) {
        console.log(`Ready! Logged in as ${client.user?.tag}`);
        
        // Configura el Rich Presence / Estado personalizado
        client.user?.setPresence({
            activities: [{
                name: 'customstatus',
                type: ActivityType.Custom,
                state: 'Moderando el servidor de Daki'
            }],
            status: 'online'
        });
    }
};
