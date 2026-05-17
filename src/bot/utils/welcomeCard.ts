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
            blurCtx.filter = 'blur(28px)';
            ctx.drawImage(background, 0, 0, canvasW, canvasH);
            blurCtx.filter = 'none';
        } catch {
            const g = ctx.createLinearGradient(0, 0, canvasW, canvasH);
            g.addColorStop(0, '#10151f');
            g.addColorStop(1, '#151a24');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, canvasW, canvasH);
        }
    } else {
        const g = ctx.createLinearGradient(0, 0, canvasW, canvasH);
        g.addColorStop(0, '#10151f');
        g.addColorStop(1, '#151a24');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // Premium overlay
    const overlay = ctx.createLinearGradient(0, 0, canvasW, canvasH);
    overlay.addColorStop(0, 'rgba(8, 10, 16, 0.55)');
    overlay.addColorStop(0.5, 'rgba(8, 10, 16, 0.66)');
    overlay.addColorStop(1, 'rgba(8, 10, 16, 0.72)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, canvasW, canvasH);

    const glow = ctx.createRadialGradient(500, 120, 12, 500, 120, 320);
    glow.addColorStop(0, 'rgba(115, 179, 255, 0.20)');
    glow.addColorStop(0.35, 'rgba(115, 179, 255, 0.08)');
    glow.addColorStop(1, 'rgba(115, 179, 255, 0)');
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
    ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 14;
    roundRect(cardX, cardY, cardW, cardH, 26);
    const panel = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    panel.addColorStop(0, 'rgba(13, 17, 26, 0.84)');
    panel.addColorStop(0.5, 'rgba(11, 15, 24, 0.84)');
    panel.addColorStop(1, 'rgba(9, 12, 20, 0.90)');
    ctx.fillStyle = panel;
    ctx.fill();
    ctx.restore();

    // Soft border
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Accent strip
    const accent = ctx.createLinearGradient(cardX + 80, cardY, cardX + cardW - 80, cardY);
    accent.addColorStop(0, 'rgba(59, 130, 246, 0)');
    accent.addColorStop(0.5, 'rgba(99, 179, 255, 0.95)');
    accent.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = accent;
    roundRect(cardX + 78, cardY + 18, cardW - 156, 4, 999);
    ctx.fill();

    // Avatar centered
    const avatarSize = 126;
    const avatarX = canvasW / 2 - avatarSize / 2;
    const avatarY = cardY + 34;
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
        ctx.lineWidth = 9;
        ctx.strokeStyle = 'rgba(255,255,255,0.80)';
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#5b8cff';
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
    } catch (e) {
        // ignore avatar errors
    }

    // Text area centered
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eef2ff';

    const title = '¡Bienvenido/a al servidor!';
    ctx.font = `800 34px "${fontFamily}", sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(14, 20, 34, 0.95)';
    ctx.strokeText(title, canvasW / 2, 232);
    ctx.fillStyle = '#ff5d5d';
    ctx.fillText(title, canvasW / 2, 232);

    const username = user.tag;
    ctx.font = `700 26px "${fontFamily}", sans-serif`;
    ctx.fillStyle = '#d7dbe7';
    ctx.strokeStyle = 'rgba(14, 20, 34, 0.90)';
    ctx.strokeText(username, canvasW / 2, 268);
    ctx.fillText(username, canvasW / 2, 268);

    const subtitle = `Te damos la bienvenida a ${guild.name}`;
    ctx.font = `700 18px "${fontFamily}", sans-serif`;
    ctx.fillStyle = '#f4f7fb';
    ctx.strokeStyle = 'rgba(14, 20, 34, 0.85)';
    ctx.strokeText(subtitle, canvasW / 2, 296);
    ctx.fillText(subtitle, canvasW / 2, 296);

    // Small bottom accent dots
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(canvasW / 2 - 74, 299, 2.4, 0, Math.PI * 2);
    ctx.arc(canvasW / 2 + 74, 299, 2.4, 0, Math.PI * 2);
    ctx.fill();

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
}