import { Client, Collection, GatewayIntentBits } from 'discord.js';
import loadEvents from './handlers/eventHandler.js';
import loadCommands from './handlers/commandHandler.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';

export class CustomClient extends Client {
    public commands: Collection<string, any>;
    public player!: Player;

    constructor(options: any) {
        super(options);
        this.commands = new Collection();
    }
}

export async function startBot() {
    const intents = [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // ← Ahora siempre va a pedir el permiso para ver los miembros
        GatewayIntentBits.GuildVoiceStates, // Necesario para bot de música
    ];

    if (process.env.ENABLE_MESSAGE_CONTENT_INTENT === 'true') {
        intents.push(GatewayIntentBits.MessageContent);
    }

    const client = new CustomClient({
        intents
    });

    // Inicializar el reproductor de música
    client.player = new Player(client as any);
    
    // Cargar los extractores por defecto (YouTube, Spotify, SoundCloud, etc.)
    await client.player.extractors.loadMulti(DefaultExtractors);

    await loadEvents(client as any);
    await loadCommands(client as any);

    await client.login(process.env.DISCORD_TOKEN);

    return client;
}
