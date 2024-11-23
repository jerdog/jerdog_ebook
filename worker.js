// Markov chain implementation
class MarkovGenerator {
  constructor(texts, order = 2) {
    this.order = order;
    this.cache = new Map();
    this.words = [];

    for (const text of texts) {
      const words = text.split(/\s+/);
      if (words.length > order) {
        this.words.push(...words);
        for (let i = 0; i < words.length - order; i++) {
          const key = words.slice(i, i + order).join(' ');
          const nextWord = words[i + order];
          if (!this.cache.has(key)) {
            this.cache.set(key, []);
          }
          this.cache.get(key).push(nextWord);
        }
      }
    }
  }

  generate(maxLength = 100) {
    if (this.words.length < this.order) {
      return this.words.join(' ');
    }

    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops
    let generatedText = '';

    while (attempts < maxAttempts) {
      const startIdx = Math.floor(Math.random() * (this.words.length - this.order));
      let current = this.words.slice(startIdx, startIdx + this.order);
      const result = [...current];

      // Generate text
      for (let i = 0; i < maxLength; i++) {
        const key = current.join(' ');
        if (!this.cache.has(key)) break;

        const nextWords = this.cache.get(key);
        const nextWord = nextWords[Math.floor(Math.random() * nextWords.length)];
        result.push(nextWord);
        current = result.slice(-this.order);
      }

      generatedText = result.join(' ');
      
      // Check if the text meets our length requirements
      if (generatedText.length >= 100 && generatedText.length <= 280) {
        return generatedText;
      }

      attempts++;
    }

    // If we couldn't generate text within limits after max attempts,
    // truncate or pad the last attempt
    if (generatedText.length > 280) {
      // Truncate to last complete word within 280 chars
      return generatedText.substring(0, 280).replace(/\s\S*$/, '');
    } else if (generatedText.length < 100 && this.words.length >= 5) {
      // Pad with random words from training data if too short
      while (generatedText.length < 100) {
        const randomWord = this.words[Math.floor(Math.random() * this.words.length)];
        generatedText += ' ' + randomWord;
      }
      return generatedText;
    }

    return generatedText;
  }
}

class BlueskyAPI {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.did = null;
    this.jwt = null;
  }

  async login() {
    const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: this.username, password: this.password })
    });

    const data = await response.json();
    this.did = data.did;
    this.jwt = data.accessJwt;
    return this.jwt;
  }

  async getPosts(handle, limit = 100) {
    try {
      if (!this.jwt) {
        await this.login();
      }

      // Resolve handle to DID
      const handleResponse = await fetch(
        `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`,
        {
          headers: { 'Authorization': `Bearer ${this.jwt}` }
        }
      );
      const { did } = await handleResponse.json();

      // Get posts
      const postsResponse = await fetch(
        `https://bsky.social/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&limit=${limit}`,
        {
          headers: { 'Authorization': `Bearer ${this.jwt}` }
        }
      );

      const data = await postsResponse.json();
      return data.feed
        .filter(item => item.post && item.post.record)
        .map(item => cleanText(item.post.record.text))
        .filter(text => text);
    } catch (error) {
      console.error('Error getting Bluesky posts:', error);
      return [];
    }
  }

  async createPost(text) {
    try {
      if (!this.jwt) {
        await this.login();
      }

      const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repo: this.did,
          collection: 'app.bsky.feed.post',
          record: {
            text,
            $type: 'app.bsky.feed.post',
            createdAt: new Date().toISOString()
          }
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Error posting to Bluesky:', error);
      return false;
    }
  }
}

class MastodonAPI {
  constructor(instanceUrl, accessToken) {
    this.instanceUrl = instanceUrl.replace(/\/$/, '');
    this.accessToken = accessToken;
  }

  async getPosts(account, limit = 100) {
    try {
      // Look up account ID
      const lookupResponse = await fetch(
        `${this.instanceUrl}/api/v1/accounts/lookup?acct=${account}`,
        {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
        }
      );
      const { id: accountId } = await lookupResponse.json();

      // Get statuses
      const statusesResponse = await fetch(
        `${this.instanceUrl}/api/v1/accounts/${accountId}/statuses?limit=${limit}&exclude_reblogs=true&exclude_replies=true`,
        {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
        }
      );

      const statuses = await statusesResponse.json();
      return statuses
        .map(status => cleanText(extractTextFromHtml(status.content)))
        .filter(text => text);
    } catch (error) {
      console.error('Error getting Mastodon posts:', error);
      return [];
    }
  }

  async createPost(text) {
    try {
      const response = await fetch(`${this.instanceUrl}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: text })
      });

      return response.ok;
    } catch (error) {
      console.error('Error posting to Mastodon:', error);
      return false;
    }
  }
}

// Utility functions
function cleanText(text) {
  return text
    .replace(/http\S+|www\.\S+/g, '') // Remove URLs
    .replace(/@\S+/g, '') // Remove mentions
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&quot;/g, '"') // Convert HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ') // Remove extra whitespace
    .replace(/[^\S\r\n]+/g, ' ') // Normalize spaces
    .replace(/\s*([,.!?])\s*/g, '$1 ') // Fix punctuation spacing
    .replace(/\s+-\s+/g, ' ') // Remove dangling hyphens
    .replace(/\s*\|\s*/g, ' ') // Remove pipe characters
    .trim();
}

// Text style configuration
const TEXT_STYLES = {
  professional: {
    minSentenceWords: 5,
    maxSentenceWords: 20,
    preferredEndings: ['.', '!'],
    hashtagProbability: 0.3,
    emojiProbability: 0.1,
    allowedEmojis: ['💡', '🚀', '💪', '✨', '🎯', '📈', '🔥', '👨‍💻', '🤝', '💭'],
    topicalHashtags: ['#DevEx', '#DevRel', '#Community', '#Tech', '#Development', '#Innovation']
  },
  casual: {
    minSentenceWords: 3,
    maxSentenceWords: 15,
    preferredEndings: ['!', '...', '?'],
    hashtagProbability: 0.5,
    emojiProbability: 0.4,
    allowedEmojis: ['😊', '🎉', '👋', '🙌', '😄', '💯', '🎈', '✌️', '🌟', '💫'],
    topicalHashtags: ['#coding', '#techlife', '#developer', '#opensource', '#community']
  },
  technical: {
    minSentenceWords: 8,
    maxSentenceWords: 25,
    preferredEndings: ['.'],
    hashtagProbability: 0.2,
    emojiProbability: 0,
    allowedEmojis: [],
    topicalHashtags: ['#Programming', '#Architecture', '#Engineering', '#CodeQuality', '#BestPractices']
  }
};

function postProcessText(text, style = 'professional') {
  // Get style configuration
  const styleConfig = TEXT_STYLES[style] || TEXT_STYLES.professional;
  
  // Remove repeated phrases (3 or more words)
  const words = text.split(' ');
  const minPhraseLength = 3;
  const cleanedWords = [];
  
  for (let i = 0; i < words.length; i++) {
    let isDuplicate = false;
    for (let j = minPhraseLength; j <= 5; j++) {
      if (i + j > words.length) continue;
      const phrase = words.slice(i, i + j).join(' ');
      const restOfText = words.slice(i + j).join(' ');
      if (restOfText.includes(phrase)) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      cleanedWords.push(words[i]);
    }
  }

  let result = cleanedWords.join(' ')
    // Ensure proper sentence endings
    .replace(/([^.!?])\s*$/g, '$1' + styleConfig.preferredEndings[Math.floor(Math.random() * styleConfig.preferredEndings.length)])
    // Fix multiple punctuation
    .replace(/([.!?])\1+/g, '$1')
    .replace(/\s*([.!?,])\s*/g, '$1 ')
    // Split into sentences and filter by length
    .split(/[.!?]\s+/)
    .filter(sentence => {
      const wordCount = sentence.split(/\s+/).length;
      return wordCount >= styleConfig.minSentenceWords && wordCount <= styleConfig.maxSentenceWords;
    })
    .join('. ')
    .trim();

  // Only add style elements if the text is long enough
  if (result.length >= 50) {
    // Add hashtags
    if (Math.random() < styleConfig.hashtagProbability) {
      const hashtag = styleConfig.topicalHashtags[Math.floor(Math.random() * styleConfig.topicalHashtags.length)];
      result += ` ${hashtag}`;
    }

    // Add emojis
    if (styleConfig.allowedEmojis.length > 0 && Math.random() < styleConfig.emojiProbability) {
      const emoji = styleConfig.allowedEmojis[Math.floor(Math.random() * styleConfig.allowedEmojis.length)];
      // 50% chance at start, 50% chance at end
      if (Math.random() < 0.5) {
        result = `${emoji} ${result}`;
      } else {
        result = `${result} ${emoji}`;
      }
    }
  }

  // Ensure it ends with punctuation
  if (!/[.!?]$/.test(result)) {
    result += styleConfig.preferredEndings[0];
  }

  // Only return if it meets minimum length
  return result.length >= 100 ? result : null;
}

function extractTextFromHtml(html) {
  return html.replace(/<[^>]+>/g, '');
}

function shouldPost(odds = 2) {
  return Math.floor(Math.random() * odds) === 0;
}

// Main worker code
export default {
  async fetch(request, env, ctx) {
    // Handle POST requests to add training data
    if (request.method === 'POST') {
      const url = new URL(request.url);
      
      // Handle /generate endpoint
      if (url.pathname === '/generate') {
        try {
          // Optional auth check
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || authHeader !== `Bearer ${env.API_SECRET}`) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'content-type': 'application/json' }
            });
          }

          // Run the scheduled handler directly
          const result = await this.scheduled(null, env, ctx);
          return new Response(JSON.stringify(result), {
            headers: { 'content-type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
          });
        }
      }

      // Handle training data upload
      try {
        const { text } = await request.json();
        if (!text) {
          throw new Error('No text provided');
        }
        
        // Get existing training data
        let trainingData = await env.TRAINING_DATA.get('corpus', { type: 'json' }) || [];
        if (!Array.isArray(trainingData)) {
          trainingData = [];
        }
        
        // Add new text and save
        trainingData.push(cleanText(text));
        await env.TRAINING_DATA.put('corpus', JSON.stringify(trainingData));
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'content-type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }
    }

    // List available endpoints
    return new Response(
      "Social Media Markov Bot\n\n" +
      "Available endpoints:\n" +
      "- POST /generate: Generate and post new content (requires API_SECRET)\n" +
      "- POST /: Add training data\n" +
      "\nScheduled posts run every 2 hours automatically.",
      {
        headers: { "content-type": "text/plain" },
      }
    );
  },

  async scheduled(event, env, ctx) {
    try {
      // Only use odds for scheduled posts, not manual triggers
      if (event && !shouldPost()) {
        return { success: true, message: 'Skipped posting based on odds' };
      }

      // Initialize APIs
      const bluesky = new BlueskyAPI(env.BLUESKY_UID, env.BLUESKY_PWD);
      const mastodon = new MastodonAPI(env.MASTODON_API_BASE_URL, env.MASTODON_ACCESS_TOKEN);

      // Get source texts
      const sourceTexts = [];

      // Get training data from KV
      const trainingData = await env.TRAINING_DATA.get('corpus', { type: 'json' }) || [];
      if (Array.isArray(trainingData)) {
        sourceTexts.push(...trainingData);
      }

      // Get Bluesky posts
      const blueskyAccounts = JSON.parse(env.BLUESKY_SOURCE_ACCOUNTS);
      for (const account of blueskyAccounts) {
        const posts = await bluesky.getPosts(account);
        sourceTexts.push(...posts);
      }

      // Get Mastodon posts
      const mastodonAccounts = JSON.parse(env.MASTODON_SOURCE_ACCOUNTS);
      for (const account of mastodonAccounts) {
        const posts = await mastodon.getPosts(account);
        sourceTexts.push(...posts);
      }

      if (sourceTexts.length === 0) {
        throw new Error('No source texts found');
      }

      // Generate new post with enhanced cleaning
      const generator = new MarkovGenerator(sourceTexts, 2);
      let newPost = null;
      let attempts = 0;
      const maxAttempts = 5;
      let style;

      while (!newPost && attempts < maxAttempts) {
        // Randomly select a style, weighted towards professional
        const styleRoll = Math.random();
        if (styleRoll < 0.6) {
          style = 'professional';
        } else if (styleRoll < 0.8) {
          style = 'casual';
        } else {
          style = 'technical';
        }

        let generatedText = generator.generate();
        newPost = postProcessText(generatedText, style);
        attempts++;
      }

      if (!newPost) {
        throw new Error('Failed to generate valid post after multiple attempts');
      }

      // Post to platforms
      const blueskySuccess = await bluesky.createPost(newPost);
      const mastodonSuccess = await mastodon.createPost(newPost);

      return {
        success: blueskySuccess || mastodonSuccess,
        message: 'Posted successfully',
        post: newPost,
        style: style,
        attempts: attempts,
        sourceCount: sourceTexts.length
      };
    } catch (error) {
      console.error('Error in scheduled task:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};
