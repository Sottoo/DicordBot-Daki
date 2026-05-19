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
                    maxOutputTokens: 300,
                    temperature: 0.7,
                }
            });

            const answer = response.text || 'No pude generar una respuesta en este momento. Inténtalo de nuevo.';

            // Si la respuesta excede los 2000 caracteres (límite de Discord), la dividimos
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
                // Creamos un hermoso embed interactivo al estilo brutalista/premium de Daki
                const embed = new EmbedBuilder()
                    .setColor('#CCFF00') // Color lima característico y premium
                    .setAuthor({ 
                        name: 'Daki Inteligencia Artificial', 
                        iconURL: interaction.client.user?.displayAvatarURL() 
                    })
                    .setTitle('💬 Respuesta a tu consulta')
                    .setDescription(`**Pregunta:** *${pregunta}*\n\n${answer}`)
                    .setFooter({ 
                        text: `Solicitado por ${interaction.user.tag}`, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error al consultar Gemini API:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0055')
                .setTitle('❌ Error de Procesamiento')
                .setDescription('Lo siento, hubo un problema al conectar con mis circuitos cerebrales de IA. Por favor, vuelve a intentarlo más tarde.')
                .setFooter({ text: 'Daki Bot IA' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
