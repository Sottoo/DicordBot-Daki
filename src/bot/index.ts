import { Client, Collection, GatewayIntentBits } from 'discord.js';
import loadEvents from './handlers/eventHandler.js';
import loadCommands from './handlers/commandHandler.js';

export class CustomClient extends Client {
    public commands: Collection<string, any>;

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
    ];

    if (process.env.ENABLE_MESSAGE_CONTENT_INTENT === 'true') {
        intents.push(GatewayIntentBits.MessageContent);
    }

    const client = new CustomClient({
        intents
    });

    await loadEvents(client);
    await loadCommands(client);

    await client.login(process.env.DISCORD_TOKEN);

    return client;
}
