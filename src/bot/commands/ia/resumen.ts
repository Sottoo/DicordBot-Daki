import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GoogleGenAI } from '@google/genai';

export default {
    data: new SlashCommandBuilder()
        .setName('resumen')
        .setDescription('Pídele a la IA que lea los últimos 50 mensajes y te haga un resumen de la charla.'),

    async execute(interaction: ChatInputCommandInteraction) {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            await interaction.reply({ 
                content: '⚠️ No hay API Key configurada para la IA.', 
                ephemeral: true 
            });
            return;
        }

        if (!interaction.channel) {
            await interaction.reply({ 
                content: '❌ No puedo leer este canal.', 
                ephemeral: true 
            });
            return;
        }

        // Deferimos porque puede tardar unos segundos en leer y procesar
        await interaction.deferReply();

        try {
            // Obtenemos los últimos 50 mensajes del canal
            const messages = await interaction.channel.messages.fetch({ limit: 50 });
            
            // Filtramos los mensajes vacíos o del sistema y los ordenamos cronológicamente
            const chatLog = messages
                .filter(m => m.content && m.content.trim().length > 0)
                .reverse()
                .map(m => `${m.author.username}: ${m.content}`)
                .join('\n');

            if (chatLog.length === 0) {
                await interaction.editReply('No hay suficientes mensajes de texto recientes para resumir.');
                return;
            }

            const ai = new GoogleGenAI({ apiKey });

            const systemInstruction = 
                "Eres Daki Bot, el moderador de este canal. Se te entregará un historial de chat reciente. " +
                "Tu objetivo es dar un resumen MUY CORTO, sarcástico y directo (máximo 4 oraciones) sobre de qué ha estado hablando la gente. " +
                "Menciona a los usuarios que más llamen la atención en el drama o la plática. " +
                "Mantén tu personalidad de amigo relajado y pasivo-agresivo.";

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Por favor resume este chat reciente:\n\n${chatLog}`,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.7,
                    maxOutputTokens: 250, // Límite un poco mayor para que alcance a dar un buen resumen sin gastar demasiado
                }
            });

            const answer = response.text || 'No pude entender de qué diablos estaban hablando.';

            // Diseño neo-brutalista para el resumen
            const resumenEmbed = new EmbedBuilder()
                .setColor('#CCFF00')
                .setAuthor({ 
                    name: 'Resumen del Chat 📋', 
                    iconURL: interaction.client.user?.displayAvatarURL() 
                })
                .setDescription(`**De qué se está hablando en <#${interaction.channel.id}>:**\n\n${answer}`)
                .setFooter({ 
                    text: `Pedido por ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [resumenEmbed] });

        } catch (error: any) {
            console.error('Error al generar resumen:', error);
            if (error?.status === 429) {
                await interaction.editReply({
                    content: '⏳ ¡Paciencia! Me están pidiendo demasiadas cosas a la vez, denme unos 40 segundos.'
                });
            } else {
                await interaction.editReply({ 
                    content: '❌ Mis circuitos fallaron tratando de leer tanto texto. Intenta más tarde.' 
                });
            }
        }
    }
};
