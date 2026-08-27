import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { importDB, flushDB, UserXP } from '../../utils/db.js';
import { esConfigGuardian, importConfig } from '../../utils/guardConfig.js';

// Valida que un valor tenga la forma { xp, level, messages } con números finitos.
function isValidUserXP(value: unknown): value is UserXP {
    if (!value || typeof value !== 'object') return false;
    const u = value as Record<string, unknown>;
    return ['xp', 'level', 'messages'].every(
        k => typeof u[k] === 'number' && Number.isFinite(u[k] as number)
    );
}

// Comprueba que todos los usuarios de un objeto tengan un esquema válido.
function validateUsers(users: unknown): { ok: boolean; count: number } {
    if (!users || typeof users !== 'object' || Array.isArray(users)) return { ok: false, count: 0 };
    const entries = Object.values(users as Record<string, unknown>);
    return { ok: entries.every(isValidUserXP), count: entries.length };
}

export default {
    data: new SlashCommandBuilder()
        .setName('importar')
        .setDescription('Restaura un backup de XP o de la configuración del guardián (Solo Admins).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addAttachmentOption(option => 
            option.setName('archivo')
                .setDescription('Un archivo generado con /backup (el de XP o el del guardián)')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const attachment = interaction.options.getAttachment('archivo', true);

        if (!attachment.name.endsWith('.json')) {
            await interaction.editReply('❌ El archivo debe ser un `.json` válido.');
            return;
        }

        try {
            // Descargamos el archivo JSON usando fetch
            const response = await fetch(attachment.url);
            const data = await response.json();

            // Verificación básica para asegurar que tiene el formato correcto
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                await interaction.editReply('❌ El formato del archivo no es válido.');
                return;
            }

            // Decidimos qué tipo de backup es por su contenido, no por el nombre:
            // el usuario puede haber renombrado el archivo al guardarlo.
            if (esConfigGuardian(data)) {
                const { ok, error } = await importConfig(data);
                if (!ok) {
                    await interaction.editReply(`❌ ${error} No se ha modificado nada.`);
                    return;
                }
                await interaction.editReply(
                    '✅ **Configuración del guardián restaurada.**\n' +
                    'Revísala ejecutando `/guardian` sin opciones. El cierre de emergencia (lockdown) queda **desactivado** ' +
                    'a propósito: su respaldo de permisos ya no sirve para el estado actual del servidor.'
                );
                return;
            }

            // Validamos el esquema de los usuarios antes de sobrescribir la BD.
            // Sin esto, valores no numéricos (p. ej. xp: "abc") corromperían la BD
            // y romperían /rank y /leaderboard con NaN.
            const usersToCheck = (data as any).users ?? data;
            const { ok, count } = validateUsers(usersToCheck);
            if (!ok) {
                await interaction.editReply('❌ El archivo no es ni un backup del guardián ni uno de XP válido (cada usuario debe tener `xp`, `level` y `messages` numéricos). No se ha modificado nada.');
                return;
            }

            // Importamos los datos a nuestra BD en memoria y forzamos el guardado
            // a disco de inmediato (sin esperar al debounce) para que la
            // restauración quede persistida aunque el proceso se reinicie enseguida.
            importDB(data as Record<string, any>);
            await flushDB();

            await interaction.editReply(`✅ **¡Base de datos restaurada con éxito!**\nSe restauraron **${count}** usuarios. Los niveles y XP han vuelto a su estado anterior.`);
            
        } catch (error) {
            console.error('Error importando DB:', error);
            await interaction.editReply('❌ Hubo un error al leer el archivo. Asegúrate de que no esté corrupto.');
        }
    }
};
