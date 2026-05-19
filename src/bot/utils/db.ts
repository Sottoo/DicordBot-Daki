import fs from 'fs';
import path from 'path';

// En Railway, usaremos el Volumen montado en /app/data. 
// En tu PC local, creará una carpeta "data" en la raíz del proyecto.
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
const dataDir = isProduction ? '/app/data' : path.join(process.cwd(), 'data');

if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
        console.error('No se pudo crear el directorio de datos:', error);
    }
}

const dbPath = path.join(dataDir, 'xp.json');

export interface UserXP {
    xp: number;
    level: number;
    messages: number;
}

let db: Record<string, UserXP> = {};

// Cargar la base de datos a la memoria RAM al iniciar
export function loadDB() {
    if (fs.existsSync(dbPath)) {
        try {
            const data = fs.readFileSync(dbPath, 'utf8');
            db = JSON.parse(data);
        } catch (error) {
            console.error("Error leyendo xp.json", error);
            db = {};
        }
    } else {
        db = {};
        saveDB();
    }
}

// Guardar la base de datos de RAM al archivo JSON
export function saveDB() {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error("Error escribiendo xp.json", error);
    }
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

    // Fórmula de niveles: Nivel = 0.1 * sqrt(XP)
    const newLevel = Math.floor(0.1 * Math.sqrt(user.xp));
    let hasLeveledUp = false;

    if (newLevel > user.level) {
        user.level = newLevel;
        hasLeveledUp = true;
    }

    // Guardamos después de cada cambio (al ser un JSON ligero, no afecta el rendimiento)
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
export function importDB(newData: Record<string, UserXP>) {
    db = newData;
    saveDB();
}

// Exportar la ruta del archivo (Para mandar por Discord)
export function getDBPath() {
    return dbPath;
}

// Inicializar al cargar el archivo
loadDB();
