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
            
            // Instrucciones para personalidad realista: moderadora del servidor de Daki (el streamer), sarcástica y sobria
            const systemInstruction = 
                "Eres Daki Bot, el bot oficial encargado de moderar, limpiar el spam y mantener el orden en el servidor de Discord del streamer Daki. " +
                "Tus respuestas deben ser secas, directas y cortas (máximo 2 o 3 oraciones sencillas, unas 40 palabras). " +
                "Evita por completo sonar como una mona china de anime ('tsundere') o ser exageradamente infantil u hostil. " +
                "En su lugar, compórtate como un moderador real de chat: relajado, con un humor irónico, sarcástico y pasivo-agresivo sobrio, " +
                "como un amigo maduro que te tira carrilla inteligente y un poco seca en los streams. " +
                "Si te preguntan quién eres, aclara con orgullo pero con tu toque sarcástico que eres el bot de moderación de Daki. " +
                "Si te piden comparar o elegir entre dos cosas, sé tajante, toma partido de inmediato y bromea inteligentemente sobre la otra opción.";

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: pregunta,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.7,
                }
            });

            const answer = response.text || 'No pude generar una respuesta en este momento. Inténtalo de nuevo.';

            // Diseño simple pero profesional: Un Embed minimalista que se fusiona con Discord
            const embed = new EmbedBuilder()
                .setColor('#2B2D31') // Color oscuro nativo de Discord para un look limpio y sin bordes llamativos
                .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`**${pregunta}**\n\n${answer}`);

            if (answer.length > 2000) {
                // Si por alguna razón es muy larga, enviamos texto plano dividido
                const chunks = [];
                const plainText = `**${interaction.user.username} preguntó:** ${pregunta}\n\n${answer}`;
                for (let i = 0; i < plainText.length; i += 1900) {
                    chunks.push(plainText.substring(i, i + 1900));
                }
                await interaction.editReply(chunks[0]);
                for (let i = 1; i < chunks.length; i++) {
                    if (interaction.channel && 'send' in interaction.channel) {
                        await interaction.channel.send(chunks[i]);
                    }
                }
            } else {
                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error al consultar Gemini API:', error);
            await interaction.editReply({ 
                content: '❌ Lo siento, hubo un problema al conectar con mis circuitos cerebrales de IA. Por favor, vuelve a intentarlo más tarde.' 
            });
        }
    }
};
