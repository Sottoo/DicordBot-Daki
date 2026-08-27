import { Events, Message, PartialMessage } from 'discord.js';
import { CustomClient } from '../index.js';
import { inspeccionar } from '../services/antiRaid.js';

/**
 * Evasión clásica que antes funcionaba al 100%: mandar "hola" y editarlo
 * después metiendo el enlace. El bot solo escuchaba messageCreate, así que
 * el mensaje editado nunca se revisaba.
 */
export default {
    name: Events.MessageUpdate,
    async execute(_antiguo: Message | PartialMessage, nuevo: Message | PartialMessage, _client: CustomClient) {
        try {
            // Con Partials activados, los mensajes no cacheados llegan incompletos.
            const mensaje = nuevo.partial ? await nuevo.fetch().catch(() => null) : (nuevo as Message);
            if (!mensaje || !mensaje.guild) return;
            if (mensaje.author?.bot && !mensaje.webhookId) return;

            await inspeccionar(mensaje);
        } catch (error) {
            console.error('[GUARDIAN] Error inspeccionando un mensaje editado:', error);
        }
    }
};
