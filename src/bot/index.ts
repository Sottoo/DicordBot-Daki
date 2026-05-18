import { Client, Collection, GatewayIntentBits } from 'discord.js';
import loadEvents from './handlers/eventHandler.js';
import loadCommands from './handlers/commandHandler.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { execSync } from 'child_process';
import path from 'path';
import { YoutubeiExtractor } from 'discord-player-youtubei';

export class CustomClient extends Client {
    public commands: Collection<string, any>;
    public player!: Player;

    constructor(options: any) {
        super(options);
        this.commands = new Collection();
    }
}

export async function startBot() {
    // ====== DIAGNÓSTICO DE AUDIO ======
    console.log('[Audio Check] Verificando dependencias de audio...');

    // Verificar FFmpeg
    try {
        const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf-8' }).split('\n')[0];
        console.log(`[Audio Check] ✅ FFmpeg del sistema encontrado: ${ffmpegVersion}`);
    } catch {
        console.warn('[Audio Check] ⚠️ FFmpeg NO está en el PATH del sistema. Buscando ffmpeg-static...');
        try {
            const ffmpegStatic = await import('ffmpeg-static');
            const ffmpegPath = (ffmpegStatic as any).default as string;
            if (ffmpegPath) {
                // Hacer ejecutable el binario y agregarlo al PATH del sistema
                const ffmpegDir = path.dirname(ffmpegPath);
                try { execSync(`chmod +x "${ffmpegPath}"`); } catch {}
                process.env.PATH = `${ffmpegDir}:${process.env.PATH}`;
                
                // Verificar que ahora sí funciona
                try {
                    const version = execSync('ffmpeg -version', { encoding: 'utf-8' }).split('\n')[0];
                    console.log(`[Audio Check] ✅ ffmpeg-static inyectado al PATH correctamente: ${version}`);
                } catch {
                    console.error(`[Audio Check] ❌ ffmpeg-static encontrado en ${ffmpegPath} pero no se puede ejecutar.`);
                }
            } else {
                console.error('[Audio Check] ❌ ffmpeg-static no retornó una ruta válida.');
            }
        } catch (e) {
            console.error('[Audio Check] ❌ No se pudo cargar ffmpeg-static:', e);
        }
    }

    // Verificar Opus
    try {
        await import('opusscript');
        console.log('[Audio Check] ✅ opusscript (codificador Opus JS) encontrado.');
    } catch {
        console.warn('[Audio Check] ⚠️ opusscript no encontrado.');
    }
    try {
        await import('mediaplex');
        console.log('[Audio Check] ✅ mediaplex (codificador nativo) encontrado.');
    } catch {
        console.warn('[Audio Check] ⚠️ mediaplex nativo no disponible (es normal en algunos entornos).');
    }

    // Verificar libsodium
    try {
        await import('libsodium-wrappers');
        console.log('[Audio Check] ✅ libsodium-wrappers (encriptación) encontrado.');
    } catch {
        console.warn('[Audio Check] ⚠️ libsodium-wrappers no encontrado.');
    }
    console.log('[Audio Check] Diagnóstico completo.');
    // ====== FIN DIAGNÓSTICO ======

    const intents = [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // ← Ahora siempre va a pedir el permiso para ver los miembros
        GatewayIntentBits.GuildVoiceStates, // Necesario para bot de música
    ];

    if (process.env.ENABLE_MESSAGE_CONTENT_INTENT === 'true') {
        intents.push(GatewayIntentBits.MessageContent);
    }

    const client = new CustomClient({
        intents
    });

    // Inicializar el reproductor de música
    client.player = new Player(client as any);
    
    // Logs de depuración para ver por qué falla la música
    client.player.events.on('playerStart', (queue, track) => {
        console.log(`[Player] ▶️ Reproduciendo: ${track.title} | Fuente: ${track.raw?.source || track.source}`);
        
        // Inspeccionar el estado interno del reproductor
        try {
            const dispatcher = queue.dispatcher;
            if (dispatcher) {
                console.log(`[Player Deep] Dispatcher existe: ✅`);
                console.log(`[Player Deep] Voice connection status: ${(dispatcher as any).voiceConnection?.state?.status || 'desconocido'}`);
                console.log(`[Player Deep] Audio player status: ${(dispatcher as any).audioPlayer?.state?.status || 'desconocido'}`);
                
                // Escuchar errores en el stream
                const audioResource = (dispatcher as any).audioResource;
                if (audioResource) {
                    console.log(`[Player Deep] Audio resource existe: ✅`);
                    console.log(`[Player Deep] Audio resource readable: ${audioResource.readable}`);
                    console.log(`[Player Deep] Audio resource ended: ${audioResource.ended}`);
                    
                    if (audioResource.playStream) {
                        audioResource.playStream.on('error', (err: any) => {
                            console.error(`[Player Deep] ❌ Error en el playStream:`, err);
                        });
                        audioResource.playStream.on('end', () => {
                            console.log(`[Player Deep] playStream terminó`);
                        });
                    }
                } else {
                    console.error(`[Player Deep] ❌ Audio resource NO existe`);
                }
            } else {
                console.error(`[Player Deep] ❌ Dispatcher NO existe`);
            }
        } catch (e) {
            console.error(`[Player Deep] Error inspeccionando:`, e);
        }
    });
    client.player.events.on('playerFinish', (queue, track) => {
        console.log(`[Player] ⏏️ Canción terminada: ${track.title}`);
    });
    client.player.events.on('playerSkip', (queue, track) => {
        console.log(`[Player] ⏭️ Canción saltada automáticamente: ${track.title} (posible error de stream)`);
    });
    client.player.events.on('audioTrackAdd', (queue, track) => {
        console.log(`[Player] ➕ Canción añadida a la cola: ${track.title}`);
    });
    client.player.events.on('connection', (queue) => {
        console.log(`[Player] 🔊 Conectado al canal de voz`);
    });
    client.player.events.on('disconnect', () => {
        console.log(`[Player] 🔇 Desconectado del canal de voz`);
    });
    client.player.events.on('emptyQueue', (queue) => {
        console.log(`[Player] 📭 La cola está vacía`);
    });
    client.player.events.on('emptyChannel', (queue) => {
        console.log(`[Player] 👻 Canal de voz vacío`);
    });
    client.player.events.on('playerError', (queue, error, track) => {
        console.error(`[Player Error Audio] Error en: ${track.title}`, error);
    });
    client.player.events.on('error', (queue, error) => {
        console.error(`[Player Error General] Error en la cola:`, error);
    });
    client.player.on('debug', (message) => {
        console.log(`[Player Debug] ${message}`);
    });

    // El módulo play-dl fue instalado y discord-player lo detectará automáticamente 
    // como el motor principal para YouTube (DP_FORCE_YTDL_MOD=play-dl se puede usar si falla).
    
    // Cargar extractores por defecto
    await client.player.extractors.loadMulti(DefaultExtractors);
    
    // Deshabilitar SoundCloud para evitar bloqueos de IP
    client.player.extractors.unregister('com.discord-player.soundcloudextractor');
    client.player.extractors.unregister('com.discord-player.youtubeextractor'); // Deshabilitamos el viejo
    
    // Registrar YoutubeiExtractor con cookies para evadir bloqueos de IP en Railway
    const ytCookie = process.env.YOUTUBE_COOKIE || '';
    if (!ytCookie) {
        console.warn('[Player] ⚠️ YOUTUBE_COOKIE no está configurada. YouTube probablemente bloqueará las peticiones desde Railway.');
        console.warn('[Player] ⚠️ Exporta tus cookies de YouTube y agrégalas como variable de entorno YOUTUBE_COOKIE en Railway.');
    } else {
        console.log('[Player] ✅ Cookies de YouTube detectadas.');
    }
    
    await client.player.extractors.register(YoutubeiExtractor, {
        // Cookies de una sesión real de YouTube para evadir bloqueos de IP
        cookie: ytCookie || undefined,
        // Usar cliente ANDROID_MUSIC para evitar la necesidad de descifrar signatures de JS
        streamOptions: {
            useClient: 'ANDROID_MUSIC' as any
        },
        // No fallar si hay errores de login
        ignoreSignInErrors: true,
    });
    console.log('[Player] Configurado para usar YoutubeiExtractor con cliente ANDROID_MUSIC.');

    await loadEvents(client as any);
    await loadCommands(client as any);

    await client.login(process.env.DISCORD_TOKEN);

    return client;
}
