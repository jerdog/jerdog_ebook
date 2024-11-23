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

    const startIdx = Math.floor(Math.random() * (this.words.length - this.order));
    let current = this.words.slice(startIdx, startIdx + this.order);
    const result = [...current];

    for (let i = 0; i < maxLength; i++) {
      const key = current.join(' ');
      if (!this.cache.has(key)) break;

      const nextWords = this.cache.get(key);
      const nextWord = nextWords[Math.floor(Math.random() * nextWords.length)];
      result.push(nextWord);
      current = result.slice(-this.order);
    }

    return result.join(' ');
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
    .replace(/\s+/g, ' ') // Remove extra whitespace
    .trim();
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

    return new Response("Social Media Markov Bot - Use the scheduled handler to generate posts or POST to add training data", {
      headers: { "content-type": "text/plain" },
    });
  },

  async scheduled(event, env, ctx) {
    try {
      if (!shouldPost()) {
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

      // Generate new post
      const generator = new MarkovGenerator(sourceTexts, 2);
      const newPost = generator.generate();

      // Post to platforms
      const blueskySuccess = await bluesky.createPost(newPost);
      const mastodonSuccess = await mastodon.createPost(newPost);

      return {
        success: blueskySuccess && mastodonSuccess,
        message: 'Posted successfully',
        post: newPost,
        sourceCount: sourceTexts.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};
