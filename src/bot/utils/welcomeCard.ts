import { AttachmentBuilder, Guild, User } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';

export async function createWelcomeCard(guild: Guild, user: User, displayName: string) {
    const canvas = createCanvas(900, 300);
    const ctx = canvas.getContext('2d');
    const blurCtx = ctx as typeof ctx & { filter: string };

    const guildIconUrl = guild.iconURL({ extension: 'png', size: 1024 });
    if (guildIconUrl) {
        const background = await loadImage(guildIconUrl);
        blurCtx.filter = 'blur(20px)';
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
        blurCtx.filter = 'none';
    } else {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#111827');
        gradient.addColorStop(1, '#1f2937');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cardX = 30;
    const cardY = 30;
    const cardW = canvas.width - 60;
    const cardH = canvas.height - 60;

    ctx.fillStyle = 'rgba(20, 20, 26, 0.78)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 28);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(170, 150, 78, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
    ctx.drawImage(avatar, 92, 72, 156, 156);
    ctx.restore();

    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(170, 150, 80, 0, Math.PI * 2);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.fillText('BIENVENIDO AL SERVIDOR DE DAKI', 585, 135);

    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#f3f4f6';
    ctx.fillText(user.tag, 585, 180);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText(`¡Hola ${displayName}!`, 585, 222);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#d1d5db';
    ctx.fillText('Esperamos que disfrutes tu estadía con nosotros.', 585, 252);

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
}