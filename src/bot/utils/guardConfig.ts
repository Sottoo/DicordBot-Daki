import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { dataDir } from './db.js';

// Configuración persistente del sistema de defensa (Guardián).
// Vive en el mismo volumen que xp.json para sobrevivir a los redeploys.
const cfgPath = path.join(dataDir, 'guardian.json');
const tmpPath = cfgPath + '.tmp';

export type SancionMaxima = 'timeout' | 'kick' | 'ban';

export interface GuardianConfig {
    /** Interruptor general del sistema. */
    activo: boolean;
    /** Canal donde se registra TODO lo que hace el guardián (auditoría). */
    canalLogsId: string | null;
    /** Canal donde se avisa a los mods de incidentes graves. Si es null, usa canalLogsId. */
    canalAlertasId: string | null;
    /** Rol de moderación al que se menciona en incidentes graves. */
    rolAlertaId: string | null;
    /** Sanción máxima que el bot puede aplicar por su cuenta. */
    sancionMaxima: SancionMaxima;
    /** Cerrar automáticamente el servidor al detectar un raid crítico. */
    autoLockdown: boolean;
    /** Roles totalmente exentos del filtro de enlaces (NO del detector de raid). */
    rolesExentos: string[];
    /** Dominios que sí se pueden enviar (además de los de la lista base). */
    dominiosPermitidos: string[];
    /** Canales donde el filtro de enlaces no aplica (ej. #comparte-tus-redes). */
    canalesExentos: string[];
    /** Estado del cierre de emergencia, con respaldo para poder revertirlo. */
    lockdown: {
        activo: boolean;
        /** channelId -> valor previo del permiso SendMessages para @everyone (true/false/null). */
        respaldo: Record<string, boolean | null>;
    };
}

const DEFAULTS: GuardianConfig = {
    activo: true,
    canalLogsId: null,
    canalAlertasId: null,
    rolAlertaId: null,
    sancionMaxima: 'timeout',
    autoLockdown: false,
    rolesExentos: [],
    dominiosPermitidos: [],
    canalesExentos: [],
    lockdown: { activo: false, respaldo: {} },
};

let config: GuardianConfig = { ...DEFAULTS };

function cargar() {
    if (!fs.existsSync(cfgPath)) return;
    try {
        const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        // Mezclamos con los defaults para que añadir campos nuevos no rompa
        // configuraciones guardadas por versiones anteriores.
        config = {
            ...DEFAULTS,
            ...parsed,
            lockdown: { ...DEFAULTS.lockdown, ...(parsed.lockdown ?? {}) },
        };
    } catch (error) {
        console.error('[GUARDIAN] guardian.json corrupto, usando configuración por defecto:', error);
        config = { ...DEFAULTS };
    }
}

let escribiendo = false;
let pendiente = false;
let enCurso: Promise<void> | null = null;

async function escribir(): Promise<void> {
    if (escribiendo) {
        // Nos apuntamos al bucle de la escritura en curso (repite mientras haya
        // pendientes) y esperamos a que acabe, así quien llame puede confiar en
        // que al volver el archivo ya incluye sus cambios.
        pendiente = true;
        await enCurso;
        return;
    }
    escribiendo = true;
    enCurso = (async () => {
        try {
            do {
                pendiente = false;
                await fsp.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf8');
                await fsp.rename(tmpPath, cfgPath);
            } while (pendiente);
        } catch (error) {
            console.error('[GUARDIAN] Error guardando guardian.json:', error);
        } finally {
            escribiendo = false;
        }
    })();
    await enCurso;
}

export function getConfig(): GuardianConfig {
    return config;
}

/** Aplica cambios parciales y persiste en disco. */
export function setConfig(cambios: Partial<GuardianConfig>) {
    config = { ...config, ...cambios };
    void escribir();
}

/** Ruta del guardian.json, para poder mandarlo por Discord con /backup. */
export function getConfigPath() {
    return cfgPath;
}

/**
 * Fuerza la escritura a disco y espera a que termine. Necesario antes de leer
 * el archivo para /backup: sin esto se podría enviar una versión anterior.
 */
export async function flushConfig(): Promise<void> {
    await escribir();
}

/** ¿Este JSON tiene pinta de ser un guardian.json y no un xp.json? */
export function esConfigGuardian(datos: unknown): boolean {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return false;
    const c = datos as Record<string, unknown>;
    // activo + sancionMaxima solo existen en guardian.json.
    return typeof c.activo === 'boolean' && typeof c.sancionMaxima === 'string';
}

/**
 * Restaura la configuración desde un backup (/importar). Saneamos cada campo
 * en lugar de confiar en el archivo: un JSON editado a mano podría meter
 * valores que rompan el guardián en caliente.
 */
export async function importConfig(datos: unknown): Promise<{ ok: boolean; error?: string }> {
    if (!esConfigGuardian(datos)) {
        return { ok: false, error: 'No parece un backup del guardián (faltan `activo` y `sancionMaxima`).' };
    }

    const p = datos as Partial<GuardianConfig>;
    const soloTextos = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const sancion: SancionMaxima =
        p.sancionMaxima === 'kick' || p.sancionMaxima === 'ban' ? p.sancionMaxima : 'timeout';

    config = {
        ...DEFAULTS,
        ...p,
        sancionMaxima: sancion,
        rolesExentos: soloTextos(p.rolesExentos),
        dominiosPermitidos: soloTextos(p.dominiosPermitidos),
        canalesExentos: soloTextos(p.canalesExentos),
        // El lockdown NO se restaura a propósito: su "respaldo" son permisos de
        // canales concretos que pueden no existir ya. Restaurarlo dejaría el
        // servidor cerrado con un respaldo inservible para revertirlo.
        lockdown: { activo: false, respaldo: {} },
    };

    await escribir();
    return { ok: true };
}

// Las variables de entorno tienen prioridad al arrancar: permiten dejar el bot
// configurado en Railway sin depender de que alguien ejecute /guardian.
function aplicarEnv() {
    const env = process.env;
    if (env.GUARDIAN_LOG_CHANNEL_ID) config.canalLogsId = env.GUARDIAN_LOG_CHANNEL_ID;
    if (env.GUARDIAN_ALERT_CHANNEL_ID) config.canalAlertasId = env.GUARDIAN_ALERT_CHANNEL_ID;
    if (env.GUARDIAN_ALERT_ROLE_ID) config.rolAlertaId = env.GUARDIAN_ALERT_ROLE_ID;
    if (env.GUARDIAN_SANCION_MAXIMA) {
        const v = env.GUARDIAN_SANCION_MAXIMA.toLowerCase();
        if (v === 'timeout' || v === 'kick' || v === 'ban') config.sancionMaxima = v;
    }
    if (env.GUARDIAN_AUTO_LOCKDOWN) config.autoLockdown = env.GUARDIAN_AUTO_LOCKDOWN === 'true';
    if (env.GUARDIAN_ACTIVO) config.activo = env.GUARDIAN_ACTIVO !== 'false';
}

cargar();
aplicarEnv();
