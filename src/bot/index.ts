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
    
    // Logs de depuración para ver por qué falla la música
    client.player.events.on('playerStart', (queue, track) => {
        console.log(`[Player] ▶️ Reproduciendo: ${track.title} | Fuente: ${track.raw?.source || track.source}`);
    });
    client.player.events.on('audioTrackAdd', (queue, track) => {
        console.log(`[Player] ➕ Canción añadida a la cola: ${track.title}`);
    });
    client.player.events.on('connection', (queue) => {
        console.log(`[Player] 🔊 Conectado al canal de voz`);
    });
    client.player.events.on('disconnect', () => {
        console.log(`[Player] 🔇 Desconectado del canal de voz`);
    });
    client.player.events.on('emptyQueue', (queue) => {
        console.log(`[Player] 📭 La cola está vacía`);
    });
    client.player.events.on('emptyChannel', (queue) => {
        console.log(`[Player] 👻 Canal de voz vacío`);
    });
    client.player.events.on('playerError', (queue, error) => {
        console.error(`[Player Error Audio] El reproductor tuvo un error:`, error);
    });
    client.player.events.on('error', (queue, error) => {
        console.error(`[Player Error General] Error en la cola:`, error);
    });
    client.player.on('debug', (message) => {
        console.log(`[Player Debug] ${message}`);
    });

    // Cargar los extractores por defecto (YouTube, Spotify, SoundCloud, etc.)
    await client.player.extractors.loadMulti(DefaultExtractors);

    await loadEvents(client as any);
    await loadCommands(client as any);

    await client.login(process.env.DISCORD_TOKEN);

    return client;
}
