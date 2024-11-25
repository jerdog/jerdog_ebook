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
    this.identifier = identifier;
    this.password = password;
    this.agent = null;
  }

  async getAgent() {
    if (!this.agent) {
      const { BskyAgent } = await import('@atproto/api');
      this.agent = new BskyAgent({ service: 'https://bsky.social' });
      await this.agent.login({ identifier: this.identifier, password: this.password });
    }
    return this.agent;
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
      const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.agent.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repo: this.agent.did,
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
          // If handle fails, try with DID
          const session = await agent.getSession();
          if (!session) {
            console.warn('No session available');
            return false;
          }
          profile = await agent.getProfile({ actor: session.did });
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

  async getPosts(account) {
    try {
      const accountId = account.replace('@', '');
      // First get the account ID
      const accountInfo = await fetch(
        `${this.instanceUrl}/api/v1/accounts/lookup?acct=${accountId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      ).then(res => res.json());

      if (!accountInfo?.id) {
        console.warn(`No account found for ${account}`);
        return [];
      }

      // Then get their posts
      const statuses = await fetch(
        `${this.instanceUrl}/api/v1/accounts/${accountInfo.id}/statuses?limit=40&exclude_replies=true&exclude_reblogs=true`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      ).then(res => res.json());

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

  async checkReplies() {
    try {
      // Validate instance URL and access token
      if (!this.instanceUrl || !this.accessToken) {
        console.warn('Missing Mastodon configuration');
        return false;
      }

      // Get notifications with proper error handling
      let notifications;
      try {
        const response = await fetch(
          `${this.instanceUrl}/api/v1/notifications?types[]=mention&limit=20`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        }
        
        notifications = await response.json();
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
          
          // Post the response with proper error handling
          try {
            const postResponse = await fetch(
              `${this.instanceUrl}/api/v1/statuses`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${this.accessToken}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  status: response,
                  in_reply_to_id: notification.status.id,
                  visibility: 'public'
                })
              }
            );

            if (!postResponse.ok) {
              throw new Error(`HTTP error! status: ${postResponse.status} - ${await postResponse.text()}`);
            }

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
      // Initialize APIs
      const bluesky = new BlueskyAPI(env.BLUESKY_UID, env.BLUESKY_PWD);
      const mastodon = new MastodonAPI(env.MASTODON_API_BASE_URL, env.MASTODON_ACCESS_TOKEN);

      // Get the cron pattern that triggered this execution
      const cronPattern = event.cron;

      // Check if this is a 30-minute check (for replies) or 2-hour check (for new posts)
      const isReplyCheck = cronPattern === "*/30 * * * *";
      const isPostCheck = cronPattern === "0 */2 * * *";

      if (isReplyCheck || isPostCheck) {
        // Always check replies
        await Promise.all([
          bluesky.checkReplies(),
          mastodon.checkReplies()
        ]);
      }

      // Only create new posts on 2-hour schedule
      if (isPostCheck && shouldPost()) {
        try {
          // Get source texts with error handling
          let sourceTexts = [];
          
          // Get training data from KV
          try {
            const trainingData = await env.TRAINING_DATA.get('corpus', { type: 'json' }) || [];
            sourceTexts.push(...trainingData);
          } catch (error) {
            console.error('Error getting training data:', error);
          }

          // Get platform-specific source texts with timeouts
          const timeoutPromise = (promise, timeout) => {
            return Promise.race([
              promise,
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
              )
            ]);
          };

          try {
            const [blueskyTexts, mastodonTexts] = await Promise.all([
              timeoutPromise(bluesky.getSourceTexts(env.BLUESKY_SOURCE_ACCOUNTS), 10000),
              timeoutPromise(mastodon.getSourceTexts(env.MASTODON_SOURCE_ACCOUNTS), 10000)
            ]);

            if (blueskyTexts?.length) sourceTexts.push(...blueskyTexts);
            if (mastodonTexts?.length) sourceTexts.push(...mastodonTexts);
          } catch (error) {
            console.error('Error getting platform texts:', error);
          }

          // Ensure we have enough source texts
          if (sourceTexts.length < 10) {
            console.warn('Insufficient source texts, using training data only');
            sourceTexts = await env.TRAINING_DATA.get('corpus', { type: 'json' }) || [];
          }

          // Generate and post text
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
          const [blueskyResult, mastodonResult] = await Promise.all([
            bluesky.createPost(newPost),
            mastodon.createPost(newPost)
          ]);

          return {
            success: true,
            message: 'Posted successfully',
            post: newPost,
            style: style,
            attempts: attempts,
            sourceCount: sourceTexts.length
          };
        } catch (error) {
          console.error('Error in post generation:', error);
          throw error;
        }
      }

      return {
        success: true,
        message: isReplyCheck ? 'Checked for replies' : 'Skipped posting based on odds'
      };

    } catch (error) {
      console.error('Error in scheduled function:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};
