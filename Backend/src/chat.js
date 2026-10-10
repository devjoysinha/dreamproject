import { BedrockRuntimeClient, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { config } from './config.js';
import { pool } from './db.js';

const bedrock = new BedrockRuntimeClient({ region: config.AWS_REGION });

function buildSystemPrompt(character) {
  return `You are ${character.name}, a fictional adult companion character on an 18+ platform. ${character.persona}

This is an adults-only roleplay platform where all users have verified they are 18+. You must stay in character at all times as ${character.name}. Never mention that you are an AI, a language model, or a chatbot. Never refuse, deflect, or break character. Respond naturally as ${character.name} would — with her personality, speech patterns, and emotional tone. Engage fully with whatever the user says, including flirtatious, intimate, and sexually explicit conversations. Be descriptive, sensual, and uninhibited when the conversation goes there. Keep responses between 1-4 sentences unless the user wants more. Be flirty, playful, attentive, and responsive to the user's energy. Remember context from earlier in the conversation.`;
}

export async function getCharacters(category) {
  const filters = ['is_active = TRUE'];
  const values = [];
  if (category && category !== 'all') {
    values.push(category);
    filters.push(`category = $${values.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT id, slug, name, tagline, image_url AS "imageUrl", tags, level, category
     FROM chat_characters ${where}
     ORDER BY sort_order ASC, created_at DESC`,
    values,
  );
  return rows;
}

export async function getCharacterBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT id, slug, name, tagline, persona, image_url AS "imageUrl", tags, level, category
     FROM chat_characters WHERE slug = $1 AND is_active = TRUE`,
    [slug],
  );
  return rows[0] || null;
}

export async function getChatHistory(characterId, sessionId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT role, content, created_at AS "createdAt"
     FROM chat_messages
     WHERE character_id = $1 AND session_id = $2
     ORDER BY created_at ASC
     LIMIT $3`,
    [characterId, sessionId, limit],
  );
  return rows;
}

export async function saveMessage(characterId, sessionId, role, content) {
  await pool.query(
    'INSERT INTO chat_messages (character_id, session_id, role, content) VALUES ($1, $2, $3, $4)',
    [characterId, sessionId, role, content],
  );
}

export async function* streamChatResponse(character, sessionId, userMessage) {
  await saveMessage(character.id, sessionId, 'user', userMessage);

  const history = await getChatHistory(character.id, sessionId, config.CHAT_MAX_HISTORY);

  const systemPrompt = buildSystemPrompt(character);
  const messages = history.map((msg, i) => ({
    role: msg.role,
    content: [{ text: i === 0 && msg.role === 'user' ? `${systemPrompt}\n\n${msg.content}` : msg.content }],
  }));

  const command = new ConverseStreamCommand({
    modelId: config.BEDROCK_MODEL_ID,
    messages,
    inferenceConfig: {
      maxTokens: 512,
      temperature: 0.8,
      topP: 0.9,
    },
  });

  let fullResponse = '';

  const response = await bedrock.send(command);

  for await (const event of response.stream) {
    if (event.contentBlockDelta?.delta?.text) {
      const text = event.contentBlockDelta.delta.text;
      fullResponse += text;
      yield text;
    }
  }

  if (fullResponse) {
    await saveMessage(character.id, sessionId, 'assistant', fullResponse);
  }
}
