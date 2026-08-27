const { Events } = require('discord.js');
const config = require('../config');

const SYSTEM_PROMPT =
  'Eres un asistente del servidor de Discord. Responde de forma breve, clara y amable en español.';

// Canales de asistencia: si alguien hace reply a un mensaje enviado en
// alguno de estos canales, la IA no debe responder (aunque escriba @bot).
// La mención explícita SÍ funciona normalmente dentro de estos canales.
const CANALES_IGNORADOS = [config.LOG_CHANNEL_ID, config.EMBED_CHANNEL_ID];

const MAX_DISCORD_LENGTH = 2000;

// Historial simple por canal (en memoria) para dar algo de contexto
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

// La IA debe ignorar cualquier mensaje que sea un ping de anuncio
// (@everyone o @here). message.mentions.everyone es true en ambos casos.
function esPingDeAnuncio(message) {
  return message.mentions.everyone;
}

// Divide un texto largo en varios mensajes de máximo 2000 caracteres,
// intentando cortar en saltos de línea o espacios para no partir palabras.
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

// Si el mensaje es un reply, revisa si el mensaje al que responde
// pertenece a alguno de los canales de asistencia.
async function esReplyAAsistencia(message) {
  if (!message.reference) return false;

  try {
    const referenciado = await message.fetchReference();
    return CANALES_IGNORADOS.includes(referenciado.channelId);
  } catch {
    // Si no se puede obtener el mensaje referenciado (borrado, etc.),
    // no lo tratamos como reply a asistencia.
    return false;
  }
}

// IMPORTANTE: cuando alguien hace reply a un mensaje, Discord agrega
// automáticamente una mención "fantasma" al autor de ese mensaje aunque
// la persona no haya escrito @bot en el texto. Por eso NO usamos
// message.mentions.has(), sino que revisamos que el <@bot_id> esté
// literalmente escrito en el contenido del mensaje.
function esMencionExplicita(message, botId) {
  const regex = new RegExp(`<@!?${botId}>`);
  return regex.test(message.content);
}

function registerAIHandler(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (esPingDeAnuncio(message)) return;

    // No responder si le están haciendo reply a un mensaje de asistencia
    if (await esReplyAAsistencia(message)) return;

    // Solo responde si el usuario escribió explícitamente @bot en el texto
    // (no cuenta la mención automática que agrega Discord al hacer reply)
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