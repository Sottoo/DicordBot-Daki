import { AttachmentBuilder, Guild, User } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';

export async function createWelcomeCard(guild: Guild, user: User, displayName: string) {
    const canvasW = 1000;
    const canvasH = 320;
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d');
    const blurCtx = ctx as typeof ctx & { filter: string };

    // Background: guild icon blurred or subtle gradient
    const guildIconUrl = guild.iconURL({ extension: 'png', size: 1024 });
    if (guildIconUrl) {
        try {
            const background = await loadImage(guildIconUrl);
            blurCtx.filter = 'blur(18px)';
            ctx.drawImage(background, 0, 0, canvasW, canvasH);
            blurCtx.filter = 'none';
        } catch {
            const g = ctx.createLinearGradient(0, 0, canvasW, canvasH);
            g.addColorStop(0, '#0f1724');
            g.addColorStop(1, '#111827');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, canvasW, canvasH);
        }
    } else {
        const g = ctx.createLinearGradient(0, 0, canvasW, canvasH);
        g.addColorStop(0, '#0f1724');
        g.addColorStop(1, '#111827');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Card area
    const padding = 34;
    const cardX = padding;
    const cardY = padding;
    const cardW = canvasW - padding * 2;
    const cardH = canvasH - padding * 2;

    // Rounded rect
    const radius = 22;
    ctx.fillStyle = 'rgba(17, 24, 39, 0.62)';
    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardH, radius);
    ctx.arcTo(cardX + cardW, cardY + cardH, cardX, cardY + cardH, radius);
    ctx.arcTo(cardX, cardY + cardH, cardX, cardY, radius);
    ctx.arcTo(cardX, cardY, cardX + cardW, cardY, radius);
    ctx.closePath();
    ctx.fill();

    // Soft border
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Avatar
    const avatarX = cardX + 34;
    const avatarY = cardY + 34;
    const avatarSize = 140;
    try {
        const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
        // circular mask
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        // subtle ring
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(255,77,77,0.9)';
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
    } catch (e) {
        // ignore avatar errors
    }

    // Text area
    const textX = avatarX + avatarSize + 36;
    const textW = cardX + cardW - textX - 30;

    // Title
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 34px sans-serif';
    ctx.fillText('Bienvenido al servidor de Daki', textX, avatarY + 40);

    // Username
    ctx.font = '600 22px sans-serif';
    ctx.fillStyle = '#f3f4f6';
    ctx.fillText(user.tag, textX, avatarY + 80);

    // Welcome line (wrap)
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    const line = `¡Hola ${displayName}! Esperamos que disfrutes tu estadía y te unas a la comunidad.`;
    const maxW = textW;
    // simple wrap
    const words = line.split(' ');
    let cur = '';
    let y = avatarY + 120;
    for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        const m = ctx.measureText(test).width;
        if (m > maxW) {
            ctx.fillText(cur, textX, y);
            cur = w;
            y += 22;
        } else {
            cur = test;
        }
    }
    if (cur) ctx.fillText(cur, textX, y);

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
}