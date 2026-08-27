const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../config');

const QUESTIONS = [
  '¿Cuál es tu edad?',
  '¿Por qué quieres unirte al equipo de asistencia emocional?',
  '¿Tienes experiencia previa ayudando a otras personas emocionalmente?',
  '¿Cómo manejarías una conversación con alguien en crisis?',
  '¿Cuánto tiempo puedes dedicar semanalmente al equipo?',
  '¿Qué harías si sientes que un caso te sobrepasa?',
  '¿Cómo mantendrías la confidencialidad de las conversaciones?',
  '¿Tienes alguna experiencia previa como moderador o staff?',
  '¿Cómo te describirías en situaciones de estrés?',
  '¿Hay algo más que quieras que sepamos sobre ti?',
];

async function startApplication(interaction) {
  const user = interaction.user;

  try {
    const dm = await user.createDM();

    await interaction.reply({
      content: '📬 Te he enviado un mensaje directo con la solicitud de aplicación.',
      ephemeral: true,
    });

    await dm.send(
      '¡Hola! Vamos a comenzar tu aplicación para el equipo de **Asistencia Emocional**. Responde cada pregunta con un mensaje de texto. Tienes 5 minutos por pregunta.'
    );

    const respuestas = [];

    for (let i = 0; i < QUESTIONS.length; i++) {
      await dm.send(`**Pregunta ${i + 1}/${QUESTIONS.length}:** ${QUESTIONS[i]}`);

      const recolectados = await dm
        .awaitMessages({
          filter: (m) => m.author.id === user.id,
          max: 1,
          time: 5 * 60 * 1000,
          errors: ['time'],
        })
        .catch(() => null);

      if (!recolectados || recolectados.size === 0) {
        await dm.send('⏱️ Se agotó el tiempo. Tu aplicación fue cancelada, puedes volver a intentarlo más tarde.');
        return;
      }

      respuestas.push(recolectados.first().content);
    }

    await dm.send('✅ ¡Gracias! Tu aplicación fue enviada al equipo. Te avisaremos por aquí cuando sea revisada.');

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('📋 Nueva aplicación — Asistencia Emocional')
      .setDescription(QUESTIONS.map((q, i) => `**${q}**\n${respuestas[i]}`).join('\n\n'))
      .setFooter({ text: `ID de usuario: ${user.id}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`app_accept_${user.id}`).setLabel('Aceptar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`app_reject_${user.id}`).setLabel('Rechazar').setStyle(ButtonStyle.Danger)
    );

    const canalLog = await interaction.client.channels.fetch(config.TICKET_LOG_CHANNEL_ID);
    await canalLog.send({ content: `${user}`, embeds: [embed], components: [row] });
  } catch (err) {
    console.error('Error en el flujo de aplicación:', err);
    await user
      .send('❌ No pude enviarte el mensaje directo. Activa los mensajes directos del servidor para poder aplicar.')
      .catch(() => {});
  }
}

async function handleApplicationDecision(interaction) {
  if (!interaction.isButton()) return false;

  const match = interaction.customId.match(/^app_(accept|reject)_(\d+)$/);
  if (!match) return false;

  const [, decision, userId] = match;
  const targetUser = await interaction.client.users.fetch(userId).catch(() => null);

  if (decision === 'accept') {
    await targetUser?.send('✅ Has sido aceptado en el equipo de asistencia emocional.').catch(() => {});

    // Asignar el rol de Voluntario Emocional
    try {
      const member = await interaction.guild.members.fetch(userId);
      await member.roles.add(config.VOLUNTARIO_EMOCIONAL_ROLE_ID);
    } catch (err) {
      console.error('No se pudo asignar el rol de Voluntario Emocional:', err);
      await interaction.followUp({
        content: `⚠️ No pude asignarle el rol a <@${userId}>. Revisa que el bot tenga permiso "Gestionar Roles" y que su rol esté por encima del rol a asignar.`,
        ephemeral: true,
      });
    }
  } else {
    await targetUser?.send('❌ No has sido aceptado, pero puedes aplicar en cualquier otro momento.').catch(() => {});
  }

  const filaOriginal = interaction.message.components[0];
  const filaDeshabilitada = new ActionRowBuilder().addComponents(
    filaOriginal.components.map((c) => ButtonBuilder.from(c).setDisabled(true))
  );

  await interaction.update({
    content: `${interaction.message.content}\n\n${decision === 'accept' ? '✅ Aceptado' : '❌ Rechazado'} por ${interaction.user}`,
    components: [filaDeshabilitada],
  });

  return true;
}

module.exports = { startApplication, handleApplicationDecision };