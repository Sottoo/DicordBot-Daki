import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUser } from '../../utils/db.js';
import { createCanvas, loadImage, registerFont } from 'canvas';

export default {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Muestra tu tarjeta de nivel actual o la de otro usuario.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('El usuario que quieres inspeccionar')
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const userData = getUser(targetUser.id);

        // --- CÓDIGO DE CANVAS PARA LA TARJETA NEO-BRUTALISTA ---
        const canvas = createCanvas(800, 250);
        const ctx = canvas.getContext('2d');

        // Fondo (Blanco roto crudo típico brutalista)
        ctx.fillStyle = '#f4f4f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Borde exterior grueso (estilo brutalista)
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        // Bloque decorativo de color lima/neón a la izquierda
        ctx.fillStyle = '#CCFF00';
        ctx.fillRect(0, 0, 250, canvas.height);
        ctx.strokeRect(0, 0, 250, canvas.height); // Borde divisorio

        // Avatar
        const avatarSize = 140;
        const avatarX = 55;
        const avatarY = 55;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        try {
            const avatar = await loadImage(targetUser.displayAvatarURL({ extension: 'png', size: 256 }));
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        } catch (e) {
            // Fallback si no tiene avatar
            ctx.fillStyle = '#333333';
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        }
        ctx.restore();

        // Borde del Avatar
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Textos
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(targetUser.username.toUpperCase(), 280, 80);

        ctx.fillStyle = '#555555';
        ctx.font = '24px sans-serif';
        ctx.fillText('NIVEL', 280, 130);
        
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText(`${userData.level}`, 360, 132);

        // Barra de progreso XP (Fondo)
        const barX = 280;
        const barY = 170;
        const barWidth = 470;
        const barHeight = 40;

        ctx.fillStyle = '#E0E0E0';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Barra de progreso XP (Lleno)
        // Calculamos XP base del nivel actual y XP para el siguiente nivel
        // Nivel = 0.1 * sqrt(XP) => XP = (Nivel / 0.1)^2
        const currentLevelXP = Math.pow(userData.level / 0.1, 2);
        const nextLevelXP = Math.pow((userData.level + 1) / 0.1, 2);
        const xpNeeded = nextLevelXP - currentLevelXP;
        const xpGainedInLevel = userData.xp - currentLevelXP;

        const progressPercent = Math.min(Math.max(xpGainedInLevel / xpNeeded, 0), 1);
        
        ctx.fillStyle = '#FF0055'; // Rosa brutalista
        ctx.fillRect(barX, barY, barWidth * progressPercent, barHeight);
        ctx.strokeRect(barX, barY, barWidth * progressPercent, barHeight);

        // Texto de XP en la barra
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`${Math.floor(userData.xp)} / ${Math.floor(nextLevelXP)} XP`, barX + 15, barY + 28);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' });

        await interaction.editReply({ files: [attachment] });
    }
};
