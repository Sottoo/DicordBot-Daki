import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import loadEvents from './handlers/eventHandler.js';
import loadCommands from './handlers/commandHandler.js';

export class CustomClient extends Client {
    public commands: Collection<string, any>;

    constructor(options: any) {
        super(options);
        this.commands = new Collection();
    }
}

/**
 * Estado del intent MessageContent. /diagnostico lo lee para poder decir en
 * claro si el bot está ciego (era la causa nº1 de "el bot no hizo nada").
 */
export const estadoIntents = {
    messageContent: false,
    motivoFallo: '' as string,
};

export async function startBot() {
    const baseIntents = [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,   // bienvenidas y sanciones
        GatewayIntentBits.GuildModeration, // registro de bans/timeouts
    ];

    // MessageContent es OBLIGATORIO para moderar: sin él message.content llega
    // vacío y el anti-enlaces no puede ver nada. Ahora va activado por defecto;
    // solo se desactiva si alguien pone explícitamente 'false'.
    const quiereContenido = process.env.ENABLE_MESSAGE_CONTENT_INTENT !== 'false';

    const partials = [Partials.Message, Partials.Channel];

    async function intentarLogin(conContenido: boolean) {
        const intents = conContenido ? [...baseIntents, GatewayIntentBits.MessageContent] : [...baseIntents];
        const client = new CustomClient({ intents, partials });
        await loadEvents(client as any);
        await loadCommands(client as any);
        await client.login(process.env.DISCORD_TOKEN);
        return client;
    }

    if (!quiereContenido) {
        console.warn(
            '\n⚠️  ENABLE_MESSAGE_CONTENT_INTENT=false → el bot NO puede leer el texto de los mensajes.\n' +
            '   El anti-enlaces, el anti-spam y el chat de IA quedan INÚTILES. Quita esa variable.\n'
        );
        estadoIntents.motivoFallo = 'Desactivado a mano con ENABLE_MESSAGE_CONTENT_INTENT=false';
        return intentarLogin(false);
    }

    try {
        const client = await intentarLogin(true);
        estadoIntents.messageContent = true;
        console.log('✅ Intent MessageContent ACTIVO: el guardián puede leer los mensajes.');
        return client;
    } catch (error: any) {
        const esIntentNoPermitido = /disallowed intents/i.test(error?.message ?? '');
        if (!esIntentNoPermitido) throw error;

        // El intent no está habilitado en el Portal de Desarrolladores: Discord
        // rechaza la conexión entera. Arrancamos sin él para no dejar el bot
        // caído, pero gritamos el problema porque la moderación queda muerta.
        estadoIntents.motivoFallo = 'El "Message Content Intent" NO está activado en el Portal de Desarrolladores de Discord';
        console.error(
            '\n🛑🛑🛑 ATENCIÓN: MODERACIÓN DESACTIVADA 🛑🛑🛑\n' +
            '   Discord rechazó el intent MessageContent porque NO está habilitado en el portal.\n' +
            '   Sin él el bot NO PUEDE VER el texto de los mensajes: cero anti-enlaces, cero anti-raid.\n' +
            '   ARRÉGLALO ASÍ:\n' +
            '     1) https://discord.com/developers/applications → tu app → Bot\n' +
            '     2) Activa "MESSAGE CONTENT INTENT" (y "SERVER MEMBERS INTENT")\n' +
            '     3) Reinicia el bot\n' +
            '   Arrancando en modo degradado (solo comandos)...\n'
        );
        return intentarLogin(false);
    }
}
