/**
 * LLM Provider Abstraction for Moltdefense
 * Supports: OpenAI, Anthropic, Ollama
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * OpenAI Chat Completion
 */
async function openaiChat(messages, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1024
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Anthropic Chat Completion
 */
async function anthropicChat(messages, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const model = process.env.LLM_MODEL || 'claude-3-haiku-20240307';

  // Convert messages to Anthropic format
  // Anthropic uses 'system' separately and messages array
  let system = '';
  const anthropicMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content;
    } else {
      anthropicMessages.push({
        role: msg.role,
        content: msg.content
      });
    }
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      system: system || undefined,
      messages: anthropicMessages,
      max_tokens: options.maxTokens || 1024
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Ollama Chat Completion (local)
 */
async function ollamaChat(messages, options = {}) {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const model = process.env.LLM_MODEL || 'llama3';

  const response = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature || 0.7
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.message.content;
}

/**
 * Unified chat interface
 * @param {Array} messages - Array of {role: 'system'|'user'|'assistant', content: string}
 * @param {Object} options - Optional: temperature, maxTokens
 * @returns {string} - Assistant response
 */
async function chat(messages, options = {}) {
  const provider = process.env.LLM_PROVIDER || 'ollama';

  console.log(`Using LLM provider: ${provider}, model: ${process.env.LLM_MODEL || 'default'}`);

  switch (provider.toLowerCase()) {
    case 'openai':
      return openaiChat(messages, options);
    case 'anthropic':
      return anthropicChat(messages, options);
    case 'ollama':
      return ollamaChat(messages, options);
    default:
      throw new Error(`Unknown LLM provider: ${provider}. Use: openai, anthropic, or ollama`);
  }
}

/**
 * Check if the provider is available
 */
async function checkProvider() {
  const provider = process.env.LLM_PROVIDER || 'ollama';

  try {
    if (provider === 'ollama') {
      const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
      const response = await fetch(`${host}/api/tags`);
      if (!response.ok) {
        throw new Error('Ollama server not responding');
      }
      const data = await response.json();
      const model = process.env.LLM_MODEL || 'llama3';
      const hasModel = data.models?.some(m => m.name.startsWith(model));
      if (!hasModel) {
        console.warn(`Warning: Model '${model}' may not be installed. Run: ollama pull ${model}`);
      }
      return true;
    } else if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not set');
      }
      return true;
    } else if (provider === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not set');
      }
      return true;
    }
  } catch (error) {
    console.error(`Provider check failed: ${error.message}`);
    return false;
  }
}

module.exports = {
  chat,
  checkProvider,
  openaiChat,
  anthropicChat,
  ollamaChat
};
