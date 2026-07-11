import { registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

// Registro centralizado e idempotente de fuentes para node-canvas.
// Evita (1) registrar la misma fuente en cada render (welcomeCard lo hacía por
// llamada) y (2) que un registerFont sin proteger tire abajo la carga de un
// comando si el .ttf no existe (rank.ts lo hacía a nivel de módulo, sin guard).
//
// En Railway y en local, process.cwd() es la raíz del repo y las fuentes están
// commiteadas, así que estas rutas resuelven en ambos entornos.

// Nombre de familia para la tarjeta de bienvenida.
export const WELCOME_FONT_FAMILY = 'DakiWelcome';

let registered = false;

function tryRegister(candidates: string[], options: { family: string; weight?: string }): boolean {
    const found = candidates.find(candidate => {
        try {
            return fs.existsSync(candidate);
        } catch {
            return false;
        }
    });

    if (!found) {
        console.warn(`[FONTS] No se encontró ninguna fuente para "${options.family}"${options.weight ? ` (${options.weight})` : ''}. Se usará la fuente por defecto (posibles cuadros □).`);
        return false;
    }

    try {
        registerFont(found, options);
        return true;
    } catch (error) {
        console.error(`[FONTS] Error registrando ${found} como "${options.family}":`, error);
        return false;
    }
}

// Registra todas las fuentes una sola vez. Es seguro llamarla en cada render:
// solo hace trabajo la primera vez.
export function registerFonts(): void {
    if (registered) return;
    registered = true;

    const assets = path.join(process.cwd(), 'assets', 'fonts');
    const srcAssets = path.join(process.cwd(), 'src', 'assets', 'fonts');

    // Roboto (tarjeta /rank)
    tryRegister([path.join(srcAssets, 'Roboto-Bold.ttf'), path.join(assets, 'Roboto-Bold.ttf')], { family: 'Roboto', weight: 'bold' });
    tryRegister([path.join(srcAssets, 'Roboto-Regular.ttf'), path.join(assets, 'Roboto-Regular.ttf')], { family: 'Roboto', weight: 'normal' });

    // Fuente de la tarjeta de bienvenida
    tryRegister([
        path.join(assets, 'NotoSans-Regular.ttf'),
        path.join(assets, 'Inter-Regular.ttf'),
        path.join(srcAssets, 'NotoSans-Regular.ttf'),
    ], { family: WELCOME_FONT_FAMILY });
}
