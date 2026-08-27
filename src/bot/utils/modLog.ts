import { EmbedBuilder, Guild, TextChannel, ColorResolvable } from 'discord.js';
import { getConfig } from './guardConfig.js';

export type Gravedad = 'info' | 'aviso' | 'grave' | 'critica';

const COLORES: Record<Gravedad, ColorResolvable> = {
    info: '#5B8CFF',
    aviso: '#FFCC00',
    grave: '#FF6600',
    critica: '#FF0000',
};

const ICONOS: Record<Gravedad, string> = {
    info: 'ℹ️',
    aviso: '⚠️',
    grave: '🚨',
    critica: '🛑',
};

export interface RegistroModeracion {
    gravedad: Gravedad;
    titulo: string;
    descripcion?: string;
    campos?: { name: string; value: string; inline?: boolean }[];
    /** Menciona al rol de moderación configurado (solo para incidentes graves). */
    pingMods?: boolean;
}

async function resolverCanal(guild: Guild, canalId: string | null): Promise<TextChannel | null> {
    if (!canalId) return null;
    const canal = await guild.channels.fetch(canalId).catch(() => null);
    if (!canal || !canal.isTextBased() || !canal.isSendable()) return null;
    return canal as TextChannel;
}

/**
 * Registra una acción de moderación. Nunca lanza: si no hay canal de logs o
 * faltan permisos, cae al console.log para que el incidente no se pierda.
 */
export async function registrar(guild: Guild | null, registro: RegistroModeracion): Promise<void> {
    const linea = `[GUARDIAN/${registro.gravedad.toUpperCase()}] ${registro.titulo}` +
        (registro.descripcion ? ` — ${registro.descripcion.replace(/\n/g, ' | ')}` : '');
    console.log(linea);

    if (!guild) return;
    const cfg = getConfig();

    // Los incidentes graves van al canal de alertas (si existe); el resto al de logs.
    const esGrave = registro.gravedad === 'grave' || registro.gravedad === 'critica';
    const destinoId = esGrave ? (cfg.canalAlertasId ?? cfg.canalLogsId) : (cfg.canalLogsId ?? cfg.canalAlertasId);

    const canal = await resolverCanal(guild, destinoId);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setColor(COLORES[registro.gravedad])
        .setTitle(`${ICONOS[registro.gravedad]} ${registro.titulo}`)
        .setTimestamp()
        .setFooter({ text: 'Guardián de Daki' });

    if (registro.descripcion) embed.setDescription(registro.descripcion.slice(0, 4096));
    if (registro.campos?.length) {
        embed.addFields(registro.campos.slice(0, 25).map(c => ({
            name: c.name.slice(0, 256),
            value: (c.value || '—').slice(0, 1024),
            inline: c.inline ?? false,
        })));
    }

    const contenido = registro.pingMods && cfg.rolAlertaId ? `<@&${cfg.rolAlertaId}>` : undefined;

    await canal.send({
        content: contenido,
        embeds: [embed],
        allowedMentions: { roles: cfg.rolAlertaId ? [cfg.rolAlertaId] : [] },
    }).catch((e) => console.error('[GUARDIAN] No pude escribir en el canal de logs:', e?.message ?? e));
}

/** Avisa por DM al propietario del servidor. Se usa solo en incidentes críticos. */
export async function avisarPropietario(guild: Guild, texto: string): Promise<void> {
    try {
        const propietario = await guild.fetchOwner();
        await propietario.send(texto.slice(0, 2000));
    } catch {
        // El propietario puede tener los DMs cerrados; no es un error crítico.
    }
}

export function etiquetaUsuario(id: string, tag?: string): string {
    return tag ? `${tag} (\`${id}\`) <@${id}>` : `<@${id}> (\`${id}\`)`;
}
