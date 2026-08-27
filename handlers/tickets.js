const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  AttachmentBuilder,
  EmbedBuilder,
} = require('discord.js');
const config = require('../config');
const { startApplication } = require('./application');

// Embed principal del panel (título, requisitos y explicación) + menú plegable
function buildTicketPanelEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Soporte y Entrevistas')
    .setDescription('Selecciona una categoría del menú de abajo para abrir tu solicitud.')
    .addFields(
      {
        name: ' Requisitos de Elegibilidad',
        value:
          '• Mínimo 150 mensajes (excluye comandos de bots y canales de juegos)\n' +
          '• Mínimo 1 semana de permanencia en el servidor\n' +
          '• Historial disciplinario limpio',
      },
      {
        name: 'Requisitos de Edad',
        value: '• Bienvenida (Greeters): 16+\n' + '• Voluntario Emocional / Moderación: 15+',
      },
      {
        name: '¿Por qué reportar un incidente?',
        value:
          'Reportar cualquier incidente ayuda a mantener un espacio seguro y sano para toda la comunidad. ' +
          'Cada reporte, sin importar qué tan pequeño parezca, permite al equipo actuar a tiempo antes de que se convierta en un problema mayor.',
      }
    )
    .setImage(
      'https://cdn.discordapp.com/attachments/1527701418008510465/1542275171325444268/Soporte.png?ex=6a90a32e&is=6a8f51ae&hm=ec72c15d93530a950a1d5d7ee4b3f91021c36b3482ad03f7291d57acbb572982'
    );

  return { embeds: [embed], components: [buildTicketPanel()] };
}

// Menú plegable (StringSelectMenu) con las categorías del panel de tickets.
function buildTicketPanel() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_category_select')
    .setPlaceholder('Select..')
    .addOptions(
      {
        label: 'Reportes e Incidentes',
        description: 'Reporta un problema, queja o incidente',
        value: 'reportes',
        emoji: '🖥️',
      },
      {
        label: 'Asistencia Aplicación',
        description: 'Aplica al equipo de asistencia emocional',
        value: 'aplicacion',
        emoji: '📃',
      }
    );

  return new ActionRowBuilder().addComponents(menu);
}

async function handleCategorySelect(interaction) {
  if (!interaction.isStringSelectMenu()) return false;
  if (interaction.customId !== 'ticket_category_select') return false;

  const value = interaction.values[0];

  if (value === 'aplicacion') {
    await startApplication(interaction);
    return true;
  }

  if (value === 'reportes') {
    await createTicketChannel(interaction, 'reporte', 'Reportes e Incidentes');
    return true;
  }

  return true;
}

async function createTicketChannel(interaction, prefijo, nombreCategoria) {
  const guild = interaction.guild;
  const user = interaction.user;
  const nombreCanal = `${prefijo}-${user.username}`.toLowerCase().slice(0, 90);

  const existente = guild.channels.cache.find((c) => c.name === nombreCanal);
  if (existente) {
    return interaction.reply({
      content: `Ya tienes un ticket abierto: ${existente}`,
      ephemeral: true,
    });
  }

  const channel = await guild.channels.create({
    name: nombreCanal,
    type: ChannelType.GuildText,
    parent: config.TICKET_CATEGORY_ID || undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_transcript').setLabel('Transcripción').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({
    content: `${user} Bienvenido a tu ticket de **${nombreCategoria}**. Cuéntanos tu problema y el equipo te atenderá pronto.`,
    components: [row],
  });

  await interaction.reply({ content: `Tu ticket fue creado: ${channel}`, ephemeral: true });
}

async function handleTicketButtons(interaction) {
  if (!interaction.isButton()) return false;
  if (interaction.customId !== 'ticket_transcript' && interaction.customId !== 'ticket_close') return false;

  const cerrar = interaction.customId === 'ticket_close';
  await sendTranscript(interaction, cerrar);
  return true;
}

async function sendTranscript(interaction, cerrar) {
  await interaction.deferReply({ ephemeral: true });

  const mensajes = await interaction.channel.messages.fetch({ limit: 100 });
  const ordenados = [...mensajes.values()].reverse();
  const texto = ordenados
    .map((m) => `[${m.createdAt.toLocaleString('es-ES')}] ${m.author.tag}: ${m.content}`)
    .join('\n');

  const archivo = new AttachmentBuilder(Buffer.from(texto || 'Sin mensajes.', 'utf-8'), {
    name: `transcripcion-${interaction.channel.name}.txt`,
  });

  const canalLog = await interaction.client.channels.fetch(config.TICKET_LOG_CHANNEL_ID);
  await canalLog.send({
    content: `📄 Transcripción del ticket **${interaction.channel.name}** (solicitada por ${interaction.user})`,
    files: [archivo],
  });

  await interaction.editReply({ content: ' Transcripción generada y enviada.' });

  if (cerrar) {
    await interaction.channel.send(' Este ticket se cerrará en 5 segundos...');
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }
}

module.exports = { buildTicketPanel, buildTicketPanelEmbed, handleCategorySelect, handleTicketButtons };