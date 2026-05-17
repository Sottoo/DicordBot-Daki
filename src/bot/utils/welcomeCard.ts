import { AttachmentBuilder, Guild, User } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

export async function createWelcomeCard(guild: Guild, user: User, displayName: string) {
    const canvasW = 1000;
    const canvasH = 320;
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d');
    const blurCtx = ctx as typeof ctx & { filter: string };
    const fontFamily = 'DakiWelcome';

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    };

    // Try to register a bundled font if present to avoid missing-glyph squares
    try {
        const candidates = [
            path.resolve(process.cwd(), 'assets', 'fonts', 'NotoSans-Regular.ttf'),
            path.resolve(process.cwd(), 'assets', 'fonts', 'Inter-Regular.ttf'),
        ];
        const fontPath = candidates.find(candidate => fs.existsSync(candidate));

        if (fontPath) {
            registerFont(fontPath, { family: fontFamily });
            console.log(`[WELCOME] Registered font from ${fontPath} as ${fontFamily}`);
        } else {
            console.log(`[WELCOME] No bundled font found in ${candidates.join(', ')}`);
        }
    } catch (e) {
        console.error('[WELCOME] Error checking/registering font', e);
    }

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
            g.addColorStop(0, '#0b1020');
            g.addColorStop(0.55, '#111827');
            g.addColorStop(1, '#0f172a');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, canvasW, canvasH);
        }
    } else {
        const g = ctx.createLinearGradient(0, 0, canvasW, canvasH);
        g.addColorStop(0, '#0b1020');
        g.addColorStop(0.55, '#111827');
        g.addColorStop(1, '#0f172a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // Premium overlay
    const overlay = ctx.createLinearGradient(0, 0, canvasW, canvasH);
    overlay.addColorStop(0, 'rgba(12, 18, 35, 0.18)');
    overlay.addColorStop(0.55, 'rgba(12, 18, 35, 0.48)');
    overlay.addColorStop(1, 'rgba(6, 10, 20, 0.70)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Decorative glow
    const glow = ctx.createRadialGradient(760, 90, 10, 760, 90, 280);
    glow.addColorStop(0, 'rgba(255, 99, 132, 0.20)');
    glow.addColorStop(0.45, 'rgba(255, 99, 132, 0.08)');
    glow.addColorStop(1, 'rgba(255, 99, 132, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Card area
    const padding = 34;
    const cardX = padding;
    const cardY = padding;
    const cardW = canvasW - padding * 2;
    const cardH = canvasH - padding * 2;

    // Rounded rect panel with glass effect
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    roundRect(cardX, cardY, cardW, cardH, 28);
    const panel = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    panel.addColorStop(0, 'rgba(17, 24, 39, 0.88)');
    panel.addColorStop(0.5, 'rgba(15, 23, 42, 0.78)');
    panel.addColorStop(1, 'rgba(9, 14, 28, 0.90)');
    ctx.fillStyle = panel;
    ctx.fill();
    ctx.restore();

    // Soft border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Accent strip
    const accent = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
    accent.addColorStop(0, '#ff6b7a');
    accent.addColorStop(0.5, '#f97316');
    accent.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = accent;
    roundRect(cardX + 22, cardY + 22, 220, 7, 999);
    ctx.fill();

    // Avatar
    const avatarX = cardX + 34;
    const avatarY = cardY + 34;
    const avatarSize = 144;
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
        // layered ring
        ctx.beginPath();
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ff5d7a';
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
    } catch (e) {
        // ignore avatar errors
    }

    // Text area
    const textX = avatarX + avatarSize + 40;
    const textW = cardX + cardW - textX - 34;

    // Title
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 38px "${fontFamily}", sans-serif`;
    ctx.fillText('Bienvenido al servidor de Daki', textX, avatarY + 38);

    // Username
    const nameBadgeX = textX;
    const nameBadgeY = avatarY + 54;
    const nameBadgeW = Math.min(320, Math.max(120, ctx.measureText(user.tag).width + 38));
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(nameBadgeX, nameBadgeY, nameBadgeW, 34, 999);
    ctx.fill();
    ctx.font = `600 22px "${fontFamily}", sans-serif`;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(user.tag, nameBadgeX + 18, nameBadgeY + 23);

    // Small status chip
    const chipX = nameBadgeX + nameBadgeW + 14;
    const chipY = nameBadgeY;
    const chipText = 'NUEVO MIEMBRO';
    ctx.font = `700 12px "${fontFamily}", sans-serif`;
    const chipW = ctx.measureText(chipText).width + 28;
    ctx.fillStyle = 'rgba(255, 93, 122, 0.16)';
    roundRect(chipX, chipY, chipW, 34, 999);
    ctx.fill();
    ctx.fillStyle = '#ff9db0';
    ctx.fillText(chipText, chipX + 14, chipY + 22);

    // Welcome line (wrap)
    ctx.font = `16px "${fontFamily}", sans-serif`;
    ctx.fillStyle = '#cbd5e1';
    const line = `¡Hola ${displayName}! Nos alegra tenerte aquí. Esperamos que disfrutes tu estadía y te unas a la comunidad.`;
    const maxW = textW;
    // simple wrap
    const words = line.split(' ');
    let cur = '';
    let y = avatarY + 118;
    for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        const m = ctx.measureText(test).width;
        if (m > maxW) {
            ctx.fillText(cur, textX, y);
            cur = w;
            y += 24;
        } else {
            cur = test;
        }
    }
    if (cur) ctx.fillText(cur, textX, y);

    // Footer info row
    const footerY = cardY + cardH - 46;
    ctx.font = `600 13px "${fontFamily}", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText(`Servidor: ${guild.name}`, textX, footerY);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillText('¡Sé respetuoso y pásalo bien!', textX, footerY + 18);

    // Right-side subtle divider
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(cardX + cardW - 235, cardY + 34);
    ctx.lineTo(cardX + cardW - 235, cardY + cardH - 34);
    ctx.stroke();

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
}