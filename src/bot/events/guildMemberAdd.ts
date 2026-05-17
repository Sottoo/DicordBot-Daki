import { Events, AttachmentBuilder, GuildMember } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import { CustomClient } from '../index.js';

export default {
    name: Events.GuildMemberAdd,
    async execute(member: GuildMember, client: CustomClient) {
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID; 
        if (!welcomeChannelId) return;
        
        const channel = member.guild.channels.cache.get(welcomeChannelId);
        if (!channel || !channel.isTextBased()) return;

        try {
            // Create Canvas
            const canvas = createCanvas(700, 250);
            const ctx = canvas.getContext('2d');

            // Background
            ctx.fillStyle = '#1e1e24';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Welcome text
            ctx.font = '40px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`¡Bienvenido a Daki Server!`, 225, 100);
            
            ctx.font = '30px sans-serif';
            ctx.fillStyle = '#00ffcc';
            ctx.fillText(`${member.user.tag}`, 225, 150);

            // Draw Avatar (circle)
            ctx.beginPath();
            ctx.arc(125, 125, 75, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();

            const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
            ctx.drawImage(avatar, 50, 50, 150, 150);

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });

            await channel.send({ content: `¡Hola ${member}! Disfruta tu estadía.`, files: [attachment] });
        } catch (error) {
            console.error('Error generating welcome image:', error);
        }
    }
};
