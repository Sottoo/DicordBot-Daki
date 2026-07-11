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
        GatewayIntentBits.GuildMembers, // ← Necesario para detectar nuevos miembros (bienvenida)
    ];

    const messageContentEnabled = process.env.ENABLE_MESSAGE_CONTENT_INTENT === 'true';
    if (messageContentEnabled) {
        intents.push(GatewayIntentBits.MessageContent);
    } else {
        // El intent MessageContent es privilegiado. Sin él, message.content llega
        // vacío y anti-links, anti-spam y el chat de IA dejan de funcionar en
        // silencio. Avisamos para que no parezca un bug fantasma.
        console.warn(
            '\n⚠️  ADVERTENCIA: El intent MessageContent está DESACTIVADO.\n' +
            '   Sin él, el anti-links, el anti-spam y el chat de IA por mención NO funcionarán\n' +
            '   (message.content llegará vacío). Para activarlo:\n' +
            '   1) En el Portal de Desarrolladores de Discord → tu app → Bot → activa "Message Content Intent".\n' +
            '   2) Define la variable de entorno ENABLE_MESSAGE_CONTENT_INTENT=true.\n'
        );
    }

    const client = new CustomClient({
        intents
    });

    await loadEvents(client as any);
    await loadCommands(client as any);

    await client.login(process.env.DISCORD_TOKEN);

    return client;
}
