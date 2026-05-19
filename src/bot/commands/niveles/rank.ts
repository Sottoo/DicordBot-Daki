import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUser } from '../../utils/db.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';

// Registrar fuentes locales para evitar los cuadros (tofu blocks) en servidores Linux/Railway
registerFont(path.join(process.cwd(), 'src/assets/fonts/Roboto-Bold.ttf'), { family: 'Roboto', weight: 'bold' });
registerFont(path.join(process.cwd(), 'src/assets/fonts/Roboto-Regular.ttf'), { family: 'Roboto', weight: 'normal' });

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

        // --- CÓDIGO DE CANVAS PARA TARJETA PROFESIONAL/GAMING ---
        const canvas = createCanvas(800, 250);
        const ctx = canvas.getContext('2d');

        // Borde redondeado de toda la tarjeta
        const radius = 25;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(canvas.width - radius, 0);
        ctx.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
        ctx.lineTo(canvas.width, canvas.height - radius);
        ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
        ctx.lineTo(radius, canvas.height);
        ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.clip();

        // Fondo: Imagen premium cargada desde assets
        try {
            const bgImage = await loadImage(path.join(process.cwd(), 'src/assets/images/rank_bg.png'));
            ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        } catch (e) {
            // Fallback si por alguna razón no carga la imagen
            ctx.fillStyle = '#111214';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Capa de oscurecimiento (Glassmorphism oscuro)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Avatar
        const avatarSize = 150;
        const avatarX = 50;
        const avatarY = 50;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        try {
            const avatar = await loadImage(targetUser.displayAvatarURL({ extension: 'png', size: 256 }));
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        } catch (e) {
            ctx.fillStyle = '#333333';
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        }
        ctx.restore();

        // Aro de color alrededor del avatar (Glow púrpura/neón)
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2, true);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#9d4edd'; // Púrpura gaming
        ctx.stroke();

        // Textos (Usando la fuente Roboto local para evitar cuadrados)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 38px Roboto';
        ctx.fillText(targetUser.username, 240, 95);

        ctx.fillStyle = '#A0A0A0';
        ctx.font = '24px Roboto';
        ctx.fillText('NIVEL', 240, 145);
        
        ctx.fillStyle = '#9d4edd'; // Texto de nivel destacado
        ctx.font = 'bold 48px Roboto';
        ctx.fillText(`${userData.level}`, 315, 148);

        // Barra de progreso XP (Fondo oscuro redondeado)
        const barX = 240;
        const barY = 175;
        const barWidth = 510;
        const barHeight = 30;
        const barRadius = 15;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth, barHeight, barRadius);
        ctx.fill();

        // Barra de progreso XP (Lleno degradado)
        const currentLevelXP = Math.pow(userData.level / 0.1, 2);
        const nextLevelXP = Math.pow((userData.level + 1) / 0.1, 2);
        const xpNeeded = nextLevelXP - currentLevelXP;
        const xpGainedInLevel = userData.xp - currentLevelXP;

        let progressPercent = Math.min(Math.max(xpGainedInLevel / xpNeeded, 0), 1);
        if (progressPercent < 0.05) progressPercent = 0.05; // Mínimo visible

        const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
        gradient.addColorStop(0, '#5a189a');
        gradient.addColorStop(1, '#c77dff');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * progressPercent, barHeight, barRadius);
        ctx.fill();

        // Texto de XP en la barra (flotante a la derecha)
        ctx.fillStyle = '#E0E0E0';
        ctx.font = '18px Roboto';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.floor(userData.xp)} / ${Math.floor(nextLevelXP)} XP`, barX + barWidth - 15, barY - 12);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' });

        await interaction.editReply({ files: [attachment] });
    }
};
