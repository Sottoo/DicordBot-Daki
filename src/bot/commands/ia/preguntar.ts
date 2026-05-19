import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { GoogleGenAI } from '@google/genai';

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
                .setDescription('El módulo de Inteligencia Artificial no está configurado.\nEl administrador del bot debe agregar la variable de entorno `GEMINI_API_KEY` con una clave válida de Google AI Studio.')
                .setFooter({ text: 'Daki Bot IA' });
            
            await interaction.reply({ embeds: [noKeyEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        const pregunta = interaction.options.getString('pregunta', true);

        // Deferimos la respuesta porque la IA puede tardar unos segundos en contestar
        await interaction.deferReply();

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            // Instrucciones para personalidad pasivo-agresiva, sarcástica y sobria (humor seco y elegante)
            const systemInstruction = 
                "Eres Daki, una asistente de Discord con una personalidad sumamente sarcástica, fría y pasivo-agresiva. " +
                "Tus respuestas deben ser secas, cortas y directas al grano (máximo 2 o 3 oraciones cortas, unas 40 palabras). " +
                "NUNCA uses listas, explicaciones de Wikipedia ni introducciones largas. " +
                "Evita por completo la jerga forzada de internet como 'bro', 'pana', 'god', 'cringe' o 'no manches'. " +
                "Usa un humor negro, sutil e inteligente. Trata a los usuarios con un desdén elegante y una carrilla pasivo-agresiva sobria, " +
                "como si responderles fuera un favor que les estás haciendo de mala gana. " +
                "Si te piden comparar dos cosas o personas, sé tajante, elige una postura con desprecio hacia la otra y destruye al rival con una sola frase mordaz.";

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: pregunta,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.7,
                }
            });

            const answer = response.text || 'No pude generar una respuesta en este momento. Inténtalo de nuevo.';

            // Responder al usuario directamente como un mensaje de texto normal
            if (answer.length > 2000) {
                const chunks = [];
                for (let i = 0; i < answer.length; i += 1900) {
                    chunks.push(answer.substring(i, i + 1900));
                }

                await interaction.editReply(chunks[0]);
                for (let i = 1; i < chunks.length; i++) {
                    if (interaction.channel && 'send' in interaction.channel) {
                        await interaction.channel.send(chunks[i]);
                    }
                }
            } else {
                await interaction.editReply({ content: answer });
            }

        } catch (error: any) {
            console.error('Error al consultar Gemini API:', error);
            
            if (error?.status === 429) {
                await interaction.editReply({
                    content: '⏳ ¡Tranquilos! Me están haciendo demasiadas preguntas muy rápido. Denme unos 40 segundos para procesar todo.'
                });
            } else {
                await interaction.editReply({ 
                    content: '❌ Ugh, mis circuitos se cruzaron. Hubo un problema de conexión con mi cerebro de IA. Inténtalo más tarde.' 
                });
            }
        }
    }
};
