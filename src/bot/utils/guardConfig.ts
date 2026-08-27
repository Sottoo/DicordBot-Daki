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

async function escribir() {
    if (escribiendo) {
        pendiente = true;
        return;
    }
    escribiendo = true;
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
}

export function getConfig(): GuardianConfig {
    return config;
}

/** Aplica cambios parciales y persiste en disco. */
export function setConfig(cambios: Partial<GuardianConfig>) {
    config = { ...config, ...cambios };
    void escribir();
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
