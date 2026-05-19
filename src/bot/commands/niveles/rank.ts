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

        // --- CÓDIGO DE CANVAS PARA TARJETA MINIMALISTA Y PROFESIONAL ---
        const canvas = createCanvas(800, 250);
        const ctx = canvas.getContext('2d');

        // Borde redondeado de toda la tarjeta
        const radius = 20;
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

        // Fondo: Color sólido oscuro minimalista (Matte Black / Gris Carbón)
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Acento sutil en la parte superior (Línea delgada color azul/cyan profesional)
        ctx.fillStyle = '#3B82F6'; // Azul moderno
        ctx.fillRect(0, 0, canvas.width, 6);

        // Avatar
        const avatarSize = 140;
        const avatarX = 50;
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
            ctx.fillStyle = '#2A2A2A';
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        }
        ctx.restore();

        // Aro sutil alrededor del avatar
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2, true);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#2A2A2A'; 
        ctx.stroke();

        // Textos (Usando la fuente Roboto local para evitar cuadrados)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 36px Roboto';
        ctx.fillText(targetUser.username, 230, 100);

        // Texto de nivel
        ctx.fillStyle = '#888888';
        ctx.font = '22px Roboto';
        ctx.fillText('NIVEL', 230, 145);
        
        ctx.fillStyle = '#3B82F6'; // Mismo azul del acento superior
        ctx.font = 'bold 44px Roboto';
        ctx.fillText(`${userData.level}`, 300, 147);

        // Barra de progreso XP (Fondo oscuro minimalista)
        const barX = 230;
        const barY = 175;
        const barWidth = 520;
        const barHeight = 28; // Un poco más gruesa
        const barRadius = 14;

        ctx.fillStyle = '#222222';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth, barHeight, barRadius);
        ctx.fill();

        // Barra de progreso XP (Lleno)
        const currentLevelXP = Math.pow(userData.level / 0.07, 2);
        const nextLevelXP = Math.pow((userData.level + 1) / 0.07, 2);
        const xpNeeded = nextLevelXP - currentLevelXP;
        const xpGainedInLevel = userData.xp - currentLevelXP;

        let progressPercent = Math.min(Math.max(xpGainedInLevel / xpNeeded, 0), 1);
        if (progressPercent < 0.04 && progressPercent > 0) progressPercent = 0.04; // Min width to be visible

        if (progressPercent > 0) {
            // Un degradado súper vibrante que da mucha satisfacción visual
            const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
            gradient.addColorStop(0, '#00d2ff'); // Cyan brillante
            gradient.addColorStop(1, '#3a7bd5'); // Azul profundo

            // Agregamos un leve resplandor (Glow) a la barra llena para que resalte
            ctx.shadowColor = '#00d2ff';
            ctx.shadowBlur = 15;
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barWidth * progressPercent, barHeight, barRadius);
            ctx.fill();

            // Reseteamos las sombras para que no afecten al texto
            ctx.shadowBlur = 0;
        }

        // Texto de XP en la barra (flotante a la derecha y arriba de la barra)
        ctx.fillStyle = '#AAAAAA';
        ctx.font = 'bold 18px Roboto';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.floor(userData.xp)} / ${Math.floor(nextLevelXP)} XP`, barX + barWidth, barY - 10);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' });

        await interaction.editReply({ files: [attachment] });
    }
};
