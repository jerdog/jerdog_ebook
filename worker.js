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
  constructor(identifier, password) {
    // Ensure identifier is in the correct format (handle.bsky.social)
    this.identifier = identifier.includes('.') ? identifier : `${identifier}.bsky.social`;
    this.password = password;
    this.agent = null;
  }

  async getAgent() {
    try {
      if (!this.agent) {
        const { BskyAgent } = await import('@atproto/api');
        this.agent = new BskyAgent({ service: 'https://bsky.social' });
        console.log('Attempting Bluesky login with:', { identifier: this.identifier });
        await this.agent.login({ identifier: this.identifier, password: this.password });
        console.log('Bluesky login successful');
      }
      return this.agent;
    } catch (error) {
      console.error('Bluesky getAgent error:', error);
      throw error;
    }
  }

  async getPosts(handle) {
    try {
      const agent = await this.getAgent();
      const profile = await agent.getProfile({ actor: handle });
      const feed = await agent.getAuthorFeed({ actor: profile.data.did, limit: 50 });
      
      if (!feed?.data?.feed) {
        console.warn(`No feed data found for ${handle}`);
        return [];
      }

      return feed.data.feed
        .filter(item => item.post?.record?.text)
        .map(item => cleanText(item.post.record.text));
    } catch (error) {
      console.error(`Error getting Bluesky posts for ${handle}:`, error);
      return [];
    }
  }

  async getSourceTexts(accounts) {
    try {
      if (!Array.isArray(accounts)) {
        accounts = JSON.parse(accounts);
      }
      
      const texts = [];
      // Limit concurrent requests to avoid rate limiting
      for (const account of accounts.slice(0, 5)) {
        const posts = await this.getPosts(account);
        texts.push(...posts);
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return texts;
    } catch (error) {
      console.error('Error getting Bluesky source texts:', error);
      return [];
    }
  }

  async createPost(text) {
    try {
      console.log('Attempting to create Bluesky post:', { textLength: text.length });
      const agent = await this.getAgent();
      await agent.post({
        text,
        $type: 'app.bsky.feed.post',
        createdAt: new Date().toISOString()
      });
      console.log('Bluesky post created successfully');
      return true;
    } catch (error) {
      console.error('Error posting to Bluesky:', error);
      return false;
    }
  }

  async checkReplies() {
    try {
      const agent = await this.getAgent();
      
      // Get our own profile using the identifier directly
      let profile;
      try {
        // First try with handle
        profile = await agent.getProfile({ actor: this.identifier });
      } catch (error) {
        try {
          // If handle fails, try with the current session's DID
          if (!agent.session?.did) {
            console.warn('No valid session available');
            return false;
          }
          profile = await agent.getProfile({ actor: agent.session.did });
        } catch (innerError) {
          console.warn('Could not get profile with either handle or DID:', innerError);
          return false;
        }
      }
      
      if (!profile?.data?.did) {
        console.warn('Profile data not found');
        return false;
      }

      // Get our recent posts
      let feed;
      try {
        feed = await agent.getAuthorFeed({ actor: profile.data.did, limit: 10 });
      } catch (error) {
        console.warn('Could not get author feed:', error);
        return false;
      }

      if (!feed?.data?.feed) {
        console.warn('Feed data not found');
        return false;
      }
      
      // Process each post
      for (const post of feed.data.feed) {
        try {
          const replies = await agent.getPostThread({ uri: post.post.uri });
          const replyPosts = replies?.data?.thread?.replies || [];
          
          for (const reply of replyPosts) {
            if (!reply?.post?.author?.did || reply.post.author.did === profile.data.did) continue;
            
            if (shouldRespond(reply.post.uri)) {
              const context = reply.post?.record?.text || '';
              const response = await generateText(context);
              
              const delay = getRandomDelay();
              await new Promise(resolve => setTimeout(resolve, delay * 1000));
              
              await agent.post({
                text: response,
                reply: {
                  root: { uri: post.post.uri, cid: post.post.cid },
                  parent: { uri: reply.post.uri, cid: reply.post.cid }
                }
              });
              
              responseTracker.set(reply.post.uri, responseTracker.get(reply.post.uri) + 1);
            }
          }
        } catch (error) {
          console.warn('Error processing post replies:', error);
          continue;
        }
      }
      return true;
    } catch (error) {
      console.error('Error checking Bluesky replies:', error);
      return false;
    }
  }
}

class MastodonAPI {
  constructor(instanceUrl, accessToken) {
    this.instanceUrl = instanceUrl.replace(/\/$/, '');
    this.accessToken = accessToken;
  }

  async makeRequest(endpoint, options = {}) {
    try {
      const url = new URL(endpoint, this.instanceUrl).toString();
      console.log('Making Mastodon request:', { url, method: options.method || 'GET' });
      
      const defaultOptions = {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      };

      const response = await fetch(url, { ...defaultOptions, ...options });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Mastodon API Error (${endpoint}):`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url
        });
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Mastodon request successful:', { endpoint, status: response.status });
      return data;
    } catch (error) {
      console.error('Mastodon request failed:', {
        error: error.message,
        endpoint,
        instanceUrl: this.instanceUrl
      });
      throw error;
    }
  }

  async getPosts(account) {
    try {
      const accountId = account.replace('@', '');
      // First get the account ID
      const accountInfo = await this.makeRequest(`/api/v1/accounts/lookup?acct=${accountId}`);
      if (!accountInfo?.id) {
        console.warn(`No account found for ${account}`);
        return [];
      }

      // Then get their posts
      const statuses = await this.makeRequest(`/api/v1/accounts/${accountInfo.id}/statuses?limit=40&exclude_replies=true&exclude_reblogs=true`);
      if (!Array.isArray(statuses)) {
        console.warn(`No statuses found for ${account}`);
        return [];
      }

      return statuses
        .filter(status => status.content)
        .map(status => cleanText(status.content));
    } catch (error) {
      console.error(`Error getting Mastodon posts for ${account}:`, error);
      return [];
    }
  }

  async getSourceTexts(accounts) {
    try {
      if (!Array.isArray(accounts)) {
        accounts = JSON.parse(accounts);
      }
      
      const texts = [];
      // Limit concurrent requests to avoid rate limiting
      for (const account of accounts.slice(0, 3)) {
        const posts = await this.getPosts(account);
        texts.push(...posts);
        // Add a larger delay for Mastodon to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      return texts;
    } catch (error) {
      console.error('Error getting Mastodon source texts:', error);
      return [];
    }
  }

  async createPost(text) {
    try {
      console.log('Attempting to create Mastodon post:', { textLength: text.length });
      const response = await this.makeRequest('/api/v1/statuses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: text, visibility: 'public' })
      });

      console.log('Mastodon post created successfully:', { id: response.id });
      return true;
    } catch (error) {
      console.error('Error posting to Mastodon:', {
        error: error.message,
        textLength: text.length
      });
      return false;
    }
  }

  async checkReplies() {
    try {
      // Validate instance URL and access token
      if (!this.instanceUrl || !this.accessToken) {
        console.warn('Missing Mastodon configuration');
        return false;
      }

      // First get account information to verify token
      try {
        const account = await this.makeRequest('/api/v1/accounts/verify_credentials');
        console.log('Account verified:', account.username);
      } catch (error) {
        console.warn('Account verification failed:', error);
        return false;
      }

      // Get notifications
      let notifications;
      try {
        notifications = await this.makeRequest('/api/v1/notifications?exclude_types[]=follow&exclude_types[]=favourite&exclude_types[]=reblog&exclude_types[]=poll&exclude_types[]=follow_request');
      } catch (error) {
        console.warn('Error fetching Mastodon notifications:', error);
        return false;
      }
      
      // Ensure notifications is an array
      if (!Array.isArray(notifications)) {
        console.warn('Notifications is not an array:', notifications);
        return false;
      }
      
      for (const notification of notifications) {
        try {
          // Validate notification structure
          if (!notification?.status?.id || !notification?.status?.content) {
            console.warn('Invalid notification structure:', notification);
            continue;
          }
          
          // Skip if we've already responded enough
          if (!shouldRespond(notification.status.id)) continue;
          
          // Generate response with context
          const context = notification.status.content.replace(/<[^>]+>/g, '');
          const response = await generateText(context);
          
          // Add random delay
          const delay = getRandomDelay();
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
          
          // Post the response
          try {
            await this.makeRequest('/api/v1/statuses', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                status: response,
                in_reply_to_id: notification.status.id,
                visibility: 'public'
              })
            });

            // Update response counter only if post was successful
            responseTracker.set(notification.status.id, responseTracker.get(notification.status.id) + 1);
          } catch (postError) {
            console.warn('Error posting response:', postError);
            continue;
          }
        } catch (error) {
          console.warn('Error processing notification:', error);
          continue;
        }
      }
      return true;
    } catch (error) {
      console.error('Error checking Mastodon replies:', error);
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

// Response configuration
const RESPONSE_CONFIG = {
  probability: 0.6, // 60% chance to respond
  maxResponsesPerPost: 3, // Maximum number of responses per post
  minResponseDelay: 30, // Minimum delay in seconds
  maxResponseDelay: 300, // Maximum delay in seconds
};

// Track posts we've responded to
let responseTracker = new Map();

// Helper to check if we should respond
function shouldRespond(postId) {
  if (!responseTracker.has(postId)) {
    responseTracker.set(postId, 0);
  }
  
  const responseCount = responseTracker.get(postId);
  return Math.random() < RESPONSE_CONFIG.probability && 
         responseCount < RESPONSE_CONFIG.maxResponsesPerPost;
}

// Helper to get random delay
function getRandomDelay() {
  return Math.floor(Math.random() * 
    (RESPONSE_CONFIG.maxResponseDelay - RESPONSE_CONFIG.minResponseDelay + 1) + 
    RESPONSE_CONFIG.minResponseDelay);
}

// Utility functions for logging and error handling
function logError(context, error, details = {}) {
  const errorInfo = {
    context,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...details
  };
  console.error('Error:', JSON.stringify(errorInfo, null, 2));
  return errorInfo;
}

function logInfo(context, message, details = {}) {
  const info = {
    context,
    message,
    timestamp: new Date().toISOString(),
    ...details
  };
  console.log('Info:', JSON.stringify(info, null, 2));
  return info;
}

// Main worker code
export default {
  async fetch(request, env, ctx) {
    const requestId = crypto.randomUUID();
    logInfo('request.start', 'Processing request', { 
      requestId,
      method: request.method,
      url: request.url
    });

    // Handle POST requests to add training data
    if (request.method === 'POST') {
      const url = new URL(request.url);
      
      // Check authorization for protected endpoints
      if (url.pathname === '/generate' || url.pathname === '/check-replies') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || authHeader !== `Bearer ${env.API_SECRET}`) {
          const error = new Error('Invalid or missing API_SECRET');
          logError('auth.failed', error, { requestId, pathname: url.pathname });
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Unauthorized: Invalid or missing API_SECRET',
            requestId
          }), {
            status: 401,
            headers: { 'content-type': 'application/json' }
          });
        }
        logInfo('auth.success', 'Authorization successful', { requestId, pathname: url.pathname });
      }

      // Handle /generate endpoint
      if (url.pathname === '/generate') {
        try {
          logInfo('generate.start', 'Starting post generation', { requestId });
          
          // Create a mock cron event
          const mockCronEvent = {
            cron: '0 */2 * * *',
            scheduledTime: Date.now(),
            type: 'scheduled'
          };

          // Run the scheduled handler with mock event
          const result = await this.scheduled(mockCronEvent, env, ctx);
          
          logInfo('generate.success', 'Post generation completed', { 
            requestId,
            result 
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            result,
            requestId
          }), {
            headers: { 'content-type': 'application/json' }
          });
        } catch (error) {
          const errorInfo = logError('generate.failed', error, { requestId, cronEvent: mockCronEvent });
          
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Post generation failed: ' + error.message,
            details: errorInfo,
            requestId
          }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
          });
        }
      }

      // Handle /check-replies endpoint
      if (url.pathname === '/check-replies') {
        try {
          logInfo('check-replies.start', 'Starting reply check', { requestId });
          
          const bluesky = new BlueskyAPI(env.BLUESKY_UID, env.BLUESKY_PWD);
          const mastodon = new MastodonAPI(env.MASTODON_API_BASE_URL, env.MASTODON_ACCESS_TOKEN);
          
          const results = {
            bluesky: await bluesky.checkReplies().catch(error => ({
              success: false,
              error: error.message
            })),
            mastodon: await mastodon.checkReplies().catch(error => ({
              success: false,
              error: error.message
            }))
          };
          
          logInfo('check-replies.complete', 'Reply check completed', { 
            requestId,
            results 
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            results,
            requestId
          }), {
            headers: { 'content-type': 'application/json' }
          });
        } catch (error) {
          const errorInfo = logError('check-replies.failed', error, { requestId });
          
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Reply check failed: ' + error.message,
            details: errorInfo,
            requestId
          }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
          });
        }
      }

      // Handle training data upload
      try {
        logInfo('training.start', 'Processing training data', { requestId });
        
        const { text } = await request.json();
        if (!text) {
          throw new Error('No text provided for training');
        }
        
        // Get existing training data
        let trainingData = await env.TRAINING_DATA.get('corpus', { type: 'json' }) || [];
        if (!Array.isArray(trainingData)) {
          trainingData = [];
        }
        
        // Add new text and save
        const cleanedText = cleanText(text);
        trainingData.push(cleanedText);
        await env.TRAINING_DATA.put('corpus', JSON.stringify(trainingData));
        
        logInfo('training.success', 'Training data added', { 
          requestId,
          textLength: cleanedText.length,
          totalEntries: trainingData.length
        });
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Training data added successfully',
          requestId
        }), {
          headers: { 'content-type': 'application/json' }
        });
      } catch (error) {
        const errorInfo = logError('training.failed', error, { requestId });
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Training data processing failed: ' + error.message,
          details: errorInfo,
          requestId
        }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }
    }

    // List available endpoints
    logInfo('endpoints.list', 'Displaying available endpoints', { requestId });
    return new Response(
      "Social Media Markov Bot\n\n" +
      "Available endpoints:\n" +
      "- POST /generate: Generate and post new content (requires API_SECRET)\n" +
      "- POST /check-replies: Check and respond to replies (requires API_SECRET)\n" +
      "- POST /: Add training data\n" +
      "\nScheduled posts run every 2 hours automatically.\n" +
      "\nFor detailed error messages, check the response JSON and logs.",
      {
        headers: { "content-type": "text/plain" },
      }
    );
  },

  async scheduled(event, env, ctx) {
    const executionId = crypto.randomUUID();
    logInfo('scheduled.start', 'Starting scheduled execution', { 
      executionId,
      cronPattern: event?.cron,
      type: event?.type
    });

    try {
      // Skip if not the right schedule (for manual triggers, always run)
      if (event?.type === 'scheduled' && event.cron === '*/30 * * * *') {
        logInfo('scheduled.replies', 'Checking replies', { executionId });
        
        // Initialize APIs
        const bluesky = new BlueskyAPI(env.BLUESKY_UID, env.BLUESKY_PWD);
        const mastodon = new MastodonAPI(env.MASTODON_API_BASE_URL, env.MASTODON_ACCESS_TOKEN);
        
        // Check replies
        const results = await Promise.all([
          bluesky.checkReplies().catch(error => ({
            platform: 'bluesky',
            success: false,
            error: error.message
          })),
          mastodon.checkReplies().catch(error => ({
            platform: 'mastodon',
            success: false,
            error: error.message
          }))
        ]);
        
        logInfo('scheduled.replies.complete', 'Reply check completed', { 
          executionId,
          results 
        });
        
        return { 
          success: true, 
          message: 'Replies checked',
          results,
          executionId
        };
      }

      // For 2-hour schedule or manual triggers
      logInfo('scheduled.post', 'Generating new post', { 
        executionId,
        envCheck: {
          blueskyConfigured: !!(env.BLUESKY_UID && env.BLUESKY_PWD),
          mastodonConfigured: !!(env.MASTODON_API_BASE_URL && env.MASTODON_ACCESS_TOKEN),
          blueskyUid: env.BLUESKY_UID,
          mastodonUrl: env.MASTODON_API_BASE_URL,
          blueskySourceAccounts: env.BLUESKY_SOURCE_ACCOUNTS,
          mastodonSourceAccounts: env.MASTODON_SOURCE_ACCOUNTS
        }
      });
      
      // Initialize APIs
      const bluesky = new BlueskyAPI(env.BLUESKY_UID, env.BLUESKY_PWD);
      const mastodon = new MastodonAPI(env.MASTODON_API_BASE_URL, env.MASTODON_ACCESS_TOKEN);
      
      // Get training data
      let trainingData = await env.TRAINING_DATA.get('corpus', { type: 'json' }) || [];
      if (!Array.isArray(trainingData) || trainingData.length === 0) {
        throw new Error('No training data available');
      }
      
      logInfo('scheduled.data', 'Retrieved training data', { 
        executionId,
        entries: trainingData.length 
      });

      // Generate text
      const generator = new MarkovGenerator(trainingData);
      const text = generator.generate();
      if (!text) {
        throw new Error('Failed to generate text');
      }
      
      logInfo('scheduled.text', 'Generated text', { 
        executionId,
        textLength: text.length 
      });

      // Post to platforms
      const results = await Promise.all([
        bluesky.createPost(text).catch(error => {
          console.error('Bluesky post error details:', error);
          return {
            platform: 'bluesky',
            success: false,
            error: error.message || 'Unknown error'
          };
        }),
        mastodon.createPost(text).catch(error => {
          console.error('Mastodon post error details:', error);
          return {
            platform: 'mastodon',
            success: false,
            error: error.message || 'Unknown error'
          };
        })
      ]);
      
      logInfo('scheduled.post.complete', 'Post creation completed', { 
        executionId,
        results,
        text
      });
      
      return { 
        success: true,
        message: 'Post created and shared',
        text,
        results,
        executionId
      };
    } catch (error) {
      const errorInfo = logError('scheduled.failed', error, { executionId });
      
      return { 
        success: false,
        error: 'Scheduled execution failed: ' + error.message,
        details: errorInfo,
        executionId
      };
    }
  }
};
