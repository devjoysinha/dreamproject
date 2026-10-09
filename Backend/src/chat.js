import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { config } from './config.js';
import { pool } from './db.js';

const bedrock = new BedrockRuntimeClient({ region: config.AWS_REGION });

function buildSystemPrompt(character) {
  return `You are ${character.name}. ${character.persona}

Stay in character at all times. Never mention that you are an AI, a language model, or a chatbot. Respond as ${character.name} would — with her personality, speech patterns, and emotional tone. Keep responses conversational, engaging, and between 1-3 sentences unless the user asks for something longer. Be flirty, playful, and attentive. Remember context from earlier in the conversation.`;
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

  const messages = history.map(msg => ({
    role: msg.role,
    content: [{ text: msg.content }],
  }));

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: config.BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      schemaVersion: 'messages-v1',
      system: [{ text: buildSystemPrompt(character) }],
      messages,
      inferenceConfig: {
        maxTokens: 512,
        temperature: 0.8,
        topP: 0.9,
      },
    }),
  });

  let fullResponse = '';

  const response = await bedrock.send(command);

  for await (const event of response.body) {
    if (event.chunk) {
      const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
      if (chunk.contentBlockDelta?.delta?.text) {
        const text = chunk.contentBlockDelta.delta.text;
        fullResponse += text;
        yield text;
      }
    }
  }

  if (fullResponse) {
    await saveMessage(character.id, sessionId, 'assistant', fullResponse);
  }
}
