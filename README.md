# Social Media ebook bot

A serverless social media bot that generates and posts content to multiple platforms using Markov chains and intelligent text processing.

## Features

### Multi-Platform Support
- Bluesky
- Mastodon
- Extensible design for adding more platforms

### Intelligent Text Generation
- Order-2 Markov chain algorithm
- Multiple data sources per platform
- Smart text cleaning and processing
- Length constraints (100-280 characters)
- HTML entity conversion
- Proper punctuation handling

### Intelligent Interaction
- Automated response to replies
- Context-aware responses using Markov chains
- Smart response rate limiting:
  - 60% chance to respond to any reply
  - Maximum 3 responses per post
  - Random delays (30-300 seconds)
  - Platform-specific reply handling

### Text Style Variations
The bot supports three distinct writing styles:

1. Professional (60% chance)
   - Longer, formal sentences (5-20 words)
   - Business-oriented hashtags (#DevEx, #DevRel, #Tech)
   - Limited professional emojis (💡🚀💪✨)
   - Conservative emoji usage (10% chance)
   - Formal punctuation (. !)

2. Casual (20% chance)
   - Shorter, relaxed sentences (3-15 words)
   - Casual hashtags (#coding, #techlife)
   - Fun emojis (😊🎉👋🙌)
   - Higher emoji usage (40% chance)
   - Varied punctuation (! ... ?)

3. Technical (20% chance)
   - Detailed sentences (8-25 words)
   - Technical hashtags (#Programming, #Architecture)
   - No emojis
   - Formal periods only
   - Focus on technical content

## Setup

### Prerequisites
- Node.js and npm
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account
- Bluesky account
- Mastodon account

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.dev.vars`:
   ```plaintext
   # Worker Environment
   API_SECRET = "your-api-secret"

   # Bluesky
   BLUESKY_UID = "your.handle.bsky.social"
   BLUESKY_PWD = "your-password"
   BLUESKY_SOURCE_ACCOUNTS = ["account1.bsky.social", "account2.bsky.social"]

   # Mastodon
   MASTODON_ACCESS_TOKEN = "your-access-token"
   MASTODON_API_BASE_URL = "https://your-instance.social"
   MASTODON_SOURCE_ACCOUNTS = ["@user@instance.social"]
   ```

4. Deploy to Cloudflare Workers:
   ```bash
   npx wrangler deploy
   ```

## Usage

### Remote Triggering

1. Generate API Secret:
   ```bash
   node -e "console.log(crypto.randomUUID())"
   ```

2. Set worker secret:
   ```bash
   npx wrangler secret put API_SECRET
   ```

### Available Endpoints

1. Generate Posts (Authenticated):
   ```bash
   curl -X POST https://your-worker-url/generate \
     -H "Authorization: Bearer your-api-secret" \
     -H "Content-Type: application/json"
   ```

2. Add Training Data:
   ```bash
   curl -X POST https://your-worker-url \
     -H "Content-Type: application/json" \
     -d '{"text":"Your training text here"}'
   ```

### Response Format

The `/generate` endpoint returns:
```json
{
  "success": true,
  "message": "Posted successfully",
  "post": "Generated text content",
  "style": "professional",
  "attempts": 1,
  "sourceCount": 123
}
```

## Scheduled Posts

The bot automatically generates posts every 2 hours with a random chance of posting (configurable). Manual triggers via the `/generate` endpoint always generate a post.

## Development

### Local Testing
```bash
npx wrangler dev
```

### Deployment
```bash
npx wrangler deploy
```

## Architecture

- **Runtime**: Cloudflare Workers (Serverless)
- **Storage**: Cloudflare KV for training data
- **Authentication**: API secret for endpoints
- **Scheduling**: Cron triggers (every 2 hours)

## Security

- No hardcoded credentials
- Environment-based configuration
- Bearer token authentication
- Minimal exposure of sensitive information

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details
