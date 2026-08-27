import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

// Dónde se guardan el XP y la configuración del guardián:
//   - DATA_DIR (si está definida) manda siempre. Es lo que se usa en un
//     servidor propio (AWS EC2, VPS...), donde no existe /app/data.
//   - En Railway el volumen está montado en /app/data.
//   - En tu PC local, una carpeta "data" en la raíz del proyecto.
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
const rutaPorDefecto = isProduction ? '/app/data' : path.join(process.cwd(), 'data');
// Exportado para que otros módulos (guardConfig) guarden en el mismo sitio.
export const dataDir = process.env.DATA_DIR || rutaPorDefecto;

if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
        // Sin esta carpeta se pierden el XP y la config del guardián en cada
        // reinicio, así que lo gritamos: fuera de Railway la causa casi siempre
        // es que DATA_DIR no está definida y se intenta escribir en /app/data.
        console.error(
            `\n🛑 No se pudo crear el directorio de datos "${dataDir}".\n` +
            '   El XP y la configuración del guardián NO se van a guardar.\n' +
            '   Si no estás en Railway, define DATA_DIR con una ruta donde el bot\n' +
            '   pueda escribir (por ejemplo DATA_DIR=/home/ubuntu/daki-bot/data).\n',
            error
        );
    }
}

const dbPath = path.join(dataDir, 'xp.json');
const tmpPath = dbPath + '.tmp';

export interface UserXP {
    xp: number;
    level: number;
    messages: number;
}

let db: Record<string, UserXP> = {};
let levelRoles: Record<string, string> = {}; // { "5": "role_id" }

// --- Motor de guardado asíncrono, atómico y con debounce ---
// En lugar de reescribir el JSON completo de forma síncrona en cada mensaje
// (lo cual bloquea el event loop y arriesga corrupción), agrupamos los cambios
// y escribimos como máximo una vez cada SAVE_DEBOUNCE_MS, de forma atómica.
const SAVE_DEBOUNCE_MS = 5000;
let saveTimer: NodeJS.Timeout | null = null;
let writing = false;      // hay una escritura en curso
let pendingWrite = false; // llegó otra petición mientras escribíamos

function serialize(): string {
    return JSON.stringify({ users: db, roles: levelRoles }, null, 2);
}

// Escritura atómica: escribimos en un archivo temporal y luego lo renombramos.
// El rename es atómico en el mismo sistema de archivos, así que nunca queda
// un xp.json a medio escribir aunque el proceso muera a mitad.
async function writeToDisk(): Promise<void> {
    if (writing) {
        pendingWrite = true;
        return;
    }
    writing = true;
    try {
        do {
            pendingWrite = false;
            const data = serialize();
            await fsp.writeFile(tmpPath, data, 'utf8');
            await fsp.rename(tmpPath, dbPath);
        } while (pendingWrite); // si algo cambió durante la escritura, repetimos
    } catch (error) {
        console.error('Error escribiendo xp.json', error);
    } finally {
        writing = false;
    }
}

// Programa un guardado con debounce (no bloquea, no espera).
export function saveDB() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void writeToDisk();
    }, SAVE_DEBOUNCE_MS);
}

// Fuerza un guardado inmediato y espera a que termine.
// Úsalo antes de leer el archivo del disco (/backup), tras una restauración
// (/importar) y al apagar el proceso, para no perder cambios pendientes.
export async function flushDB(): Promise<void> {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    await writeToDisk();
}

// Cargar la base de datos a la memoria RAM al iniciar
export function loadDB() {
    if (fs.existsSync(dbPath)) {
        try {
            const data = fs.readFileSync(dbPath, 'utf8');
            const parsed = JSON.parse(data);

            // Retrocompatibilidad con la primera versión
            if (parsed.users) {
                db = parsed.users;
                levelRoles = parsed.roles || {};
            } else {
                db = parsed;
                levelRoles = {};
            }
        } catch (error) {
            console.error("Error leyendo xp.json", error);
            db = {};
            levelRoles = {};
        }
    } else {
        db = {};
        levelRoles = {};
        saveDB();
    }
}

// Obtener y Configurar Roles de Nivel
export function getLevelRoles(): Record<string, string> {
    return levelRoles;
}

export function setLevelRole(level: number, roleId: string) {
    levelRoles[level.toString()] = roleId;
    saveDB();
}

// Obtener la info de un usuario
export function getUser(userId: string): UserXP {
    if (!db[userId]) {
        db[userId] = { xp: 0, level: 0, messages: 0 };
    }
    return db[userId];
}

// Añadir XP a un usuario
export function addXP(userId: string, xpToAdd: number): { hasLeveledUp: boolean, newLevel: number } {
    const user = getUser(userId);
    user.xp += xpToAdd;
    user.messages += 1;

    // Fórmula de niveles más difícil: Nivel = 0.07 * sqrt(XP)
    const newLevel = Math.floor(0.07 * Math.sqrt(user.xp));
    let hasLeveledUp = false;

    if (newLevel > user.level) {
        user.level = newLevel;
        hasLeveledUp = true;
    }

    // Programamos el guardado (con debounce). No bloquea el event loop.
    saveDB();

    return { hasLeveledUp, newLevel };
}

// Obtener Leaderboard (Top 10)
export function getLeaderboard(limit: number = 10): { userId: string, xp: number, level: number }[] {
    const sorted = Object.entries(db)
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.xp - a.xp);
    return sorted.slice(0, limit);
}

// Importar DB desde un archivo externo (Para migraciones)
export function importDB(newData: { users?: Record<string, UserXP>, roles?: Record<string, string> } | Record<string, UserXP>) {
    // Compatibilidad con la versión anterior que solo tenía usuarios
    if (newData.users) {
        db = newData.users as Record<string, UserXP>;
        levelRoles = (newData.roles as Record<string, string>) || {};
    } else {
        db = newData as Record<string, UserXP>;
        levelRoles = {};
    }
    saveDB();
}

// Exportar la ruta del archivo (Para mandar por Discord)
export function getDBPath() {
    return dbPath;
}

// Aseguramos que los cambios pendientes se persistan al apagar el proceso.
// Railway envía SIGTERM en cada redeploy; sin esto se perdería la ventana
// de debounce (hasta 5s de XP).
let shutdownHandled = false;
async function handleShutdown(signal: string) {
    if (shutdownHandled) return;
    shutdownHandled = true;
    console.log(`Recibido ${signal}, guardando base de datos antes de salir...`);
    try {
        await flushDB();
    } catch (error) {
        console.error('Error al guardar durante el apagado:', error);
    } finally {
        process.exit(0);
    }
}
process.once('SIGTERM', () => void handleShutdown('SIGTERM'));
process.once('SIGINT', () => void handleShutdown('SIGINT'));

// Inicializar al cargar el archivo
loadDB();
