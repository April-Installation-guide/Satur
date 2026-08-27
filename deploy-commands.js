require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('panel-tickets')
    .setDescription('Publica el panel de tickets (Reportes e Incidentes / Asistencia Aplicación)')
    .setDefaultMemberPermissions(0) // solo visible/usable por administradores por defecto
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('⏳ Registrando comandos...');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('✅ Comando /panel-tickets registrado correctamente.');
  } catch (err) {
    console.error('❌ Error registrando comandos:', err);
  }
})();
