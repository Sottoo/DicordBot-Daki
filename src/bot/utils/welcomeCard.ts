import { AttachmentBuilder, Guild, User } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

export async function createWelcomeCard(guild: Guild, user: User, displayName: string) {
    const canvasW = 1000;
    const canvasH = 320;
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d');
    const fontFamily = 'DakiWelcome';

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

    // 1. Solid Off-White Background
    ctx.fillStyle = '#F4F0EB';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 2. Brutalist Grid Pattern
    ctx.strokeStyle = '#D1CDC1';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvasW; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvasH); ctx.stroke();
    }
    for (let j = 0; j < canvasH; j += 40) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvasW, j); ctx.stroke();
    }

    // 3. Thick Black Outer Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, canvasW - 12, canvasH - 12);

    // 4. Top Header Bar
    ctx.fillStyle = '#000000';
    ctx.fillRect(6, 6, canvasW - 12, 50);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 24px "${fontFamily}", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('TICKET DE ADMISIÓN VIP', 26, 31);

    // Date/Time in header
    const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    ctx.textAlign = 'right';
    ctx.fillText(`FECHA: ${dateStr}`, canvasW - 30, 31);

    // 5. Avatar Section
    const avatarSize = 180;
    const avatarX = 50;
    const avatarY = 95;

    // Avatar Offset Shadow
    ctx.fillStyle = '#000000';
    ctx.fillRect(avatarX + 12, avatarY + 12, avatarSize, avatarSize);

    try {
        const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    } catch (e) {
        // Fallback color if avatar fails
        ctx.fillStyle = '#FF3366';
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }

    // Avatar Border
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(avatarX, avatarY, avatarSize, avatarSize);

    // 6. Typography / Welcome Message
    const textX = avatarX + avatarSize + 45;
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.font = `900 52px "${fontFamily}", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText('¡BIENVENIDO AL', textX, 90);
    ctx.fillText('SERVIDOR DE DAKI!', textX, 145);

    // Subtitle
    ctx.font = `700 24px "${fontFamily}", sans-serif`;
    ctx.fillStyle = '#4A4A4A';
    ctx.fillText(`Member ID: ${user.id}`, textX, 210);

    // Username Box
    ctx.font = `800 28px "${fontFamily}", sans-serif`;
    const tagToDisplay = `@${user.username}`;
    let usernameW = ctx.measureText(tagToDisplay).width + 40;
    
    // Check max width for username box
    const maxBoxW = canvasW - textX - 160; 
    if (usernameW > maxBoxW) usernameW = maxBoxW;

    ctx.fillStyle = '#FF3366'; // Bold pink/red accent
    ctx.fillRect(textX, 245, usernameW, 50);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 5;
    ctx.strokeRect(textX, 245, usernameW, 50);

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    
    // Simple clipping for text if too long
    ctx.save();
    ctx.beginPath();
    ctx.rect(textX, 245, usernameW, 50);
    ctx.clip();
    ctx.fillText(tagToDisplay, textX + 20, 270);
    ctx.restore();

    // 7. Ticket Perforation (tear-off line)
    ctx.beginPath();
    ctx.setLineDash([12, 10]);
    ctx.moveTo(canvasW - 170, 56);
    ctx.lineTo(canvasW - 170, canvasH - 6);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#D1CDC1';
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // 8. Decorative Barcode
    const barcodeX = canvasW - 130;
    const barcodeY = 90;
    ctx.fillStyle = '#000000';
    // Random-looking widths
    const bars = [6, 3, 8, 4, 2, 7, 12, 3, 5, 8, 2, 3, 9, 4, 6];
    let curX = barcodeX;
    for (const bw of bars) {
        if (curX + bw > canvasW - 20) break; // stay inside border
        ctx.fillRect(curX, barcodeY, bw, 185);
        curX += bw + 5;
    }

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'daki-welcome.png' });
}