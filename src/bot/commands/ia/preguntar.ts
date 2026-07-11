import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

// Cliente de IA reutilizado entre invocaciones (antes se creaba uno por comando).
let aiClient: GoogleGenAI | null = null;
function getAiClient(apiKey: string): GoogleGenAI {
    if (!aiClient) aiClient = new GoogleGenAI({ apiKey });
    return aiClient;
}

export default {
    data: new SlashCommandBuilder()
        .setName('preguntar')
        .setDescription('Hazle una pregunta a Daki usando Inteligencia Artificial.')
        .addStringOption(option =>
            option.setName('pregunta')
                .setDescription('La pregunta que quieres hacer')
                .setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            const noKeyEmbed = new EmbedBuilder()
                .setColor('#FF5555')
                .setTitle('⚠️ Configuración Incompleta')
                .setDescription('El módulo de Inteligencia Artificial no está configurado.\nEl administrador del bot debe configurarlo correctamente.')
                .setFooter({ text: 'Daki Bot' });

            await interaction.reply({ embeds: [noKeyEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        const pregunta = interaction.options.getString('pregunta', true);

        // Deferimos la respuesta porque la IA puede tardar unos segundos en contestar
        await interaction.deferReply();

        try {
            const ai = getAiClient(apiKey);

            // Instrucciones para personalidad realista: moderadora del servidor de Daki (el streamer), sarcástica y sobria
            const systemInstruction =
                "Eres Daki Bot, el bot oficial encargado de moderar, limpiar el spam y mantener el orden en el servidor de Discord del streamer Daki. " +
                "Tus respuestas deben ser, directas y cortas (máximo 2 o 3 oraciones sencillas, unas 40 palabras). " +
                "Evita por completo sonar como una mona china de anime ('tsundere') o ser exageradamente infantil u hostil. " +
                "En su lugar, compórtate como un moderador real de chat: relajado, con un humor irónico, sarcástico y pasivo-agresivo sobrio, " +
                "como un amigo maduro que te tira carrilla inteligente y un poco seca en los streams. " +
                "Si te preguntan quién eres, aclara con orgullo pero con tu toque sarcástico que eres el bot de moderación de Daki. " +
                "Si te piden comparar o elegir entre dos cosas, sé tajante, toma partido de inmediato y bromea inteligentemente sobre la otra opción.";

            const response = await ai.models.generateContent({
                model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
                contents: pregunta,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.7,
                    thinkingConfig: {
                        thinkingLevel: (process.env.GEMINI_THINKING_LEVEL?.toUpperCase() === 'LOW' ? ThinkingLevel.LOW :
                                        process.env.GEMINI_THINKING_LEVEL?.toUpperCase() === 'MEDIUM' ? ThinkingLevel.MEDIUM :
                                        process.env.GEMINI_THINKING_LEVEL?.toUpperCase() === 'HIGH' ? ThinkingLevel.HIGH :
                                        ThinkingLevel.MINIMAL)
                    }
                }
            });

            const answer = response.text || 'No pude generar una respuesta en este momento. Inténtalo de nuevo.';

            // Formateamos el mensaje para que se vea como una conversación natural (citas de Discord)
            const formattedReply = `> **${interaction.user.username}:** *${pregunta}*\n\n${answer}`;

            // Responder al usuario directamente como un mensaje de texto normal
            if (formattedReply.length > 2000) {
                const chunks = [];
                for (let i = 0; i < formattedReply.length; i += 1900) {
                    chunks.push(formattedReply.substring(i, i + 1900));
                }

                await interaction.editReply(chunks[0]);
                for (let i = 1; i < chunks.length; i++) {
                    if (interaction.channel && 'send' in interaction.channel) {
                        await interaction.channel.send(chunks[i]);
                    }
                }
            } else {
                await interaction.editReply({ content: formattedReply });
            }

        } catch (error: any) {
            console.error('Error al consultar la IA:', error);
            await interaction.editReply({
                content: '⏳ Estoy teniendo problemas para procesar. Dame 1 minuto.'
            });
        }
    }
};
