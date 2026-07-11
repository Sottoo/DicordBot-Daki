import { Events, ActivityType } from 'discord.js';
import { CustomClient } from '../index.js';
import { startTikTokWatcher } from '../services/tiktokLive.js';

export default {
    name: Events.ClientReady,
    once: true,
    execute(client: CustomClient) {
        console.log(`Ready! Logged in as ${client.user?.tag}`);

        // Configura el Rich Presence como actividad "Jugando"
        client.user?.setPresence({
            activities: [{
                name: 'moderando el servidor de Daki',
                type: ActivityType.Playing
            }],
            status: 'online'
        });

        // Arranca el vigía de directos de TikTok (avisa cuando Daki empieza stream).
        startTikTokWatcher(client);
    }
};
