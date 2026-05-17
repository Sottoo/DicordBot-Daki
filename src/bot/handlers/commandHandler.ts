import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';
import { CustomClient } from '../index.js';
import { fileURLToPath, pathToFileURL } from 'url';

export default async function loadCommands(client: CustomClient) {
    const commands: any[] = [];
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const commandsPath = path.join(__dirname, '../commands');
    
    if (!fs.existsSync(commandsPath)) {
        console.warn(`Commands directory not found: ${commandsPath}`);
        return;
    }

    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if(!fs.statSync(folderPath).isDirectory()) continue;
        
        const commandFiles = fs.readdirSync(folderPath).filter((file: string) => file.endsWith('.ts') || file.endsWith('.js'));

        for (const file of commandFiles) {
            try {
            const commandModule = await import(pathToFileURL(path.join(folderPath, file)).href);
                const command = commandModule.default;
                
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commands.push(command.data.toJSON());
                } else {
                    console.log(`[WARNING] The command at ${folder}/${file} is missing a required "data" or "execute" property.`);
                }
            } catch (error) {
                console.error(`Error loading command ${file}:`, error);
            }
        }
    }

    console.log(`[HANDLER] Loaded ${commands.length} commands locally.`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        // Notice: This registers commands globally if GUILD_ID is absent. 
        // For development, it's safer to register to a specific guild to prevent caching delays.
        if (process.env.CLIENT_ID && process.env.GUILD_ID) {
           await rest.put(
               Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
               { body: commands },
           );
           console.log('Successfully reloaded guild application (/) commands.');
        } else if (process.env.CLIENT_ID) {
           await rest.put(
               Routes.applicationCommands(process.env.CLIENT_ID),
               { body: commands },
           );
            console.log('Successfully reloaded global application (/) commands.');
        } else {
            console.warn("CLIENT_ID not found; couldn't register slash commands to Discord.");
        }
        
    } catch (error) {
        console.error("Error registering slash commands", error);
    }
}
