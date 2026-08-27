const { Events } = require('discord.js');
const config = require('../config');

const SYSTEM_PROMPT =
  'Eres un asistente del servidor de Discord. Responde de forma breve, clara y amable en español.';

const CANALES_IGNORADOS = [config.LOG_CHANNEL_ID, config.EMBED_CHANNEL_ID];

const MAX_DISCORD_LENGTH = 2000;

const historial = new Map();
const MAX_HISTORIAL = 6;

async function askDeepSeek(prompt, canalId) {
  const historialCanal = historial.get(canalId) || [];

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...historialCanal,
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    console.error('Error de la API de DeepSeek:', res.status, await res.text().catch(() => ''));
    return 'Lo siento, tuve un problema para generar una respuesta.';
  }

  const data = await res.json();
  const respuesta = data.choices?.[0]?.message?.content ?? 'Lo siento, no pude generar una respuesta.';

  const nuevoHistorial = [
    ...historialCanal,
    { role: 'user', content: prompt },
    { role: 'assistant', content: respuesta },
  ].slice(-MAX_HISTORIAL);
  historial.set(canalId, nuevoHistorial);

  return respuesta;
}

function esPingDeAnuncio(message) {
  return message.mentions.everyone;
}

function dividirEnChunks(texto, maxLength = MAX_DISCORD_LENGTH) {
  if (texto.length <= maxLength) return [texto];

  const chunks = [];
  let restante = texto;

  while (restante.length > maxLength) {
    let corte = restante.lastIndexOf('\n', maxLength);
    if (corte === -1 || corte < maxLength * 0.5) {
      corte = restante.lastIndexOf(' ', maxLength);
    }
    if (corte === -1 || corte < maxLength * 0.5) {
      corte = maxLength;
    }

    chunks.push(restante.slice(0, corte).trim());
    restante = restante.slice(corte).trimStart();
  }

  if (restante) chunks.push(restante);

  return chunks;
}

async function esReplyAAsistencia(message) {
  if (!message.reference) return false;

  try {
    const referenciado = await message.fetchReference();
    return CANALES_IGNORADOS.includes(referenciado.channelId);
  } catch {
    return false;
  }
}

function esMencionExplicita(message, botId) {
  const regex = new RegExp(`<@!?${botId}>`);
  return regex.test(message.content);
}

function registerAIHandler(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (esPingDeAnuncio(message)) return;
    if (await esReplyAAsistencia(message)) return;
    if (!esMencionExplicita(message, client.user.id)) return;

    try {
      await message.channel.sendTyping();
      const prompt = message.content.replace(/<@!?\d+>/g, '').trim();
      if (!prompt) return;

      const respuesta = await askDeepSeek(prompt, message.channel.id);
      const chunks = dividirEnChunks(respuesta);

      for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
          await message.reply({ content: chunks[i] });
        } else {
          await message.channel.send({ content: chunks[i] });
        }
      }
    } catch (err) {
      console.error('Error en el manejador de IA:', err);
    }
  });
}

module.exports = { registerAIHandler };
