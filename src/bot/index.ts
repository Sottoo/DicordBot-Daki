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
    const client = new CustomClient({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
        ]
    });

    await loadEvents(client);
    await loadCommands(client);

    await client.login(process.env.DISCORD_TOKEN);

    return client;
}
