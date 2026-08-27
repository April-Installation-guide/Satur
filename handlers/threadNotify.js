const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const config = require('../config');

const BUTTON_ID = 'voluntariado_emocional';
const cooldowns = new Map();

function registerThreadNotify(client) {
  client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
    try {
      if (!newlyCreated) return;
      if (thread.parentId !== config.FORUM_CHANNEL_ID) return;

      await thread.join().catch(() => {});

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(BUTTON_ID)
          .setLabel('✉️ Voluntariado emocional')
          .setStyle(ButtonStyle.Secondary) // gris
      );

      const autorMencion = thread.ownerId ? `<@${thread.ownerId}>` : '@usuario';

      await thread.send({
        content:
          `Hola ${autorMencion}, veo que tu mensaje es muy ¡importante! Si gustas puedes presionar el botón "✉️ Voluntariado emocional" para que se mande una notificación al Equipo de Asistencia Emocional 🐱`,
        components: [row],
      });
    } catch (err) {
      console.error('Error al enviar el mensaje en el hilo nuevo:', err);
    }
  });
}

async function handleVoluntariadoButton(interaction) {
  if (!interaction.isButton()) return false;
  if (interaction.customId !== BUTTON_ID) return false;

  const userId = interaction.user.id;
  const now = Date.now();
  const expiresAt = cooldowns.get(userId);

  if (expiresAt && now < expiresAt) {
    const minutosRestantes = Math.ceil((expiresAt - now) / 60000);
    await interaction.reply({
      content: `⏳ Ya solicitaste ayuda recientemente. Podrás volver a usar el botón en ${minutosRestantes} minuto(s).`,
      ephemeral: true,
    });
    return true;
  }

  cooldowns.set(userId, now + config.COOLDOWN_MS);

  const threadLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}`;

  try {
    // Este mensaje normal (con el ping al rol) SOLO se manda al canal de asistencia (LOG_CHANNEL_ID)
    const logChannel = await interaction.client.channels.fetch(config.LOG_CHANNEL_ID);
    if (logChannel) {
      await logChannel.send({
        content: `${interaction.user} Ha solicitado Ayuda En ${threadLink} <@&1527701416859144378>`,
        allowedMentions: {
          users: [interaction.user.id],
          roles: [config.VOLUNTARIO_EMOCIONAL_ROLE_ID],
        },
      });
    }

    const embedChannel = await interaction.client.channels.fetch(config.EMBED_CHANNEL_ID);
    if (embedChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x30d5c8) // turquesa
        .setDescription(`📩 **${interaction.user.tag}** ha solicitado ayuda\n[Ir al hilo](${threadLink})`)
        .setTimestamp();
      await embedChannel.send({ embeds: [embed] });
    }

    await interaction.reply({
      content: '✅ Tu solicitud fue enviada al equipo de voluntariado emocional.',
      ephemeral: true,
    });
  } catch (err) {
    console.error('Error al procesar la solicitud del botón:', err);
    if (!interaction.replied) {
      await interaction.reply({
        content: '❌ Ocurrió un error al enviar tu solicitud. Intenta de nuevo más tarde.',
        ephemeral: true,
      });
    }
  }

  return true;
}

module.exports = { registerThreadNotify, handleVoluntariadoButton };
