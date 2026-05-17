import fs from 'fs';
import path from 'path';
import { CustomClient } from '../index.js';
import { fileURLToPath, pathToFileURL } from 'url';

export default async function loadEvents(client: CustomClient) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const eventsPath = path.join(__dirname, '../events');
    
    if (!fs.existsSync(eventsPath)) {
        console.warn(`Events directory not found: ${eventsPath}`);
        return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter((file: string) => file.endsWith('.ts') || file.endsWith('.js'));

    await Promise.all(eventFiles.map(async (file) => {
        try {
            const eventModule = await import(pathToFileURL(path.join(eventsPath, file)).href);
            const event = eventModule.default;
            if (!event || !event.name) return;

            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
        } catch (err) {
            console.error(`Error loading event ${file}:`, err);
        }
    }));
    console.log(`[HANDLER] Loaded events handler.`);
}
