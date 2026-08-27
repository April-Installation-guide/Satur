require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');

const { registerThreadNotify, handleVoluntariadoButton } = require('./handlers/threadNotify');
const { registerAIHandler } = require('./handlers/ai');
const { buildTicketPanelEmbed, handleCategorySelect, handleTicketButtons } = require('./handlers/tickets');
const { handleApplicationDecision } = require('./handlers/application');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot conectado como ${c.user.tag}`);
});

// -------- Registro de listeners "pasivos" --------
registerThreadNotify(client); // Mensaje + botón al abrirse un hilo en el foro
registerAIHandler(client);    // IA con DeepSeek (ignora pings de @everyone/@here)

// -------- Comandos e interacciones --------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // /panel-tickets -> publica el menú plegable de categorías
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel-tickets') {
      await interaction.reply(buildTicketPanelEmbed());
      return;
    }

    // Botón "✉️ Voluntariado emocional" del foro
    if (await handleVoluntariadoButton(interaction)) return;

    // Selección de categoría en el menú plegable de tickets
    if (await handleCategorySelect(interaction)) return;

    // Botones "Transcripción" / "Cerrar Ticket"
    if (await handleTicketButtons(interaction)) return;

    // Botones "Aceptar" / "Rechazar" de las aplicaciones
    if (await handleApplicationDecision(interaction)) return;
  } catch (err) {
    console.error('Error manejando la interacción:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);