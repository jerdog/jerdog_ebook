# Social Media Markov Bot

***Forked from [tommeagher/heroku_ebooks](https://github.com/tommeagher/heroku_ebooks) and modified for Bluesky and Mastodon***

A Cloudflare Workers-based social media bot that generates and posts content using Markov chain text generation. Currently supports Bluesky and Mastodon platforms.

## Features

- Multi-platform support:
  - Bluesky integration with optimized API usage
  - Mastodon integration with HTML content handling
- Advanced Markov chain text generation:
  - Configurable chain order
  - Improved text cleaning
  - Natural language output
- Flexible source text collection:
  - Live post retrieval from social platforms
  - Filtered content (no replies, better quality)
- Smart configuration:
  - Environment-based credentials
  - Platform-specific settings
  - Debug and test modes
- Performance optimizations:
  - Serverless execution
  - Efficient API usage
  - Rate limit compliance
- Comprehensive logging:
  - Detailed error reporting
  - Debug output options
  - Operation tracking

## Setup

1. Clone this repo
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.dev.vars` file based on `.env-sample` with your credentials:
   ```
   ### BlueSky API Keys
   BLUESKY_UID = "your.handle.bsky.social"
   BLUESKY_PWD = "your-app-password"
   BLUESKY_SOURCE_ACCOUNTS = ["source.handle.bsky.social"]

   ### Mastodon API Keys
   MASTODON_ACCESS_TOKEN = "your-access-token"
   MASTODON_SOURCE_ACCOUNTS = ["@handle@instance.social"]
   MASTODON_API_BASE_URL = "https://your.instance.social"
   ```

4. Install Wrangler:
   ```bash
   npm install -g wrangler
   ```

5. Configure secrets:
   ```bash
   wrangler secret put BLUESKY_UID
   wrangler secret put BLUESKY_PWD
   wrangler secret put BLUESKY_SOURCE_ACCOUNTS
   wrangler secret put MASTODON_ACCESS_TOKEN
   wrangler secret put MASTODON_SOURCE_ACCOUNTS
   wrangler secret put MASTODON_API_BASE_URL
   ```

6. Deploy:
   ```bash
   wrangler deploy
   ```

## Configuration

### Environment Variables
- `BLUESKY_UID`: Your Bluesky handle
- `BLUESKY_PWD`: Your Bluesky app password
- `BLUESKY_SOURCE_ACCOUNTS`: JSON array of Bluesky accounts
- `MASTODON_ACCESS_TOKEN`: Mastodon access token
- `MASTODON_API_BASE_URL`: Your Mastodon instance URL
- `MASTODON_SOURCE_ACCOUNTS`: JSON array of Mastodon accounts

### Worker Configuration
Edit `wrangler.toml` to configure:
- Cron schedule
- Memory limits
- CPU time
- Environment variables

## Text Generation

The bot uses Markov chains to generate text from multiple sources:

1. **Bluesky Posts**:
   - Fetches recent posts from source accounts
   - Excludes replies for better quality
   - Removes URLs and mentions

2. **Mastodon Posts**:
   - Retrieves recent toots from source accounts
   - Handles HTML content
   - Filters boosts and replies

## Development

### Local Development
1. Install dependencies:
   ```bash
   npm install
   ```

2. Start local development server:
   ```bash
   wrangler dev
   ```

3. Test scheduled execution:
   ```bash
   wrangler dev --test-scheduled
   ```

### Testing
1. Use local environment variables in `.dev.vars`
2. Monitor logs with `wrangler tail`
3. Check execution in Cloudflare dashboard

### Best Practices
- Test locally before deployment
- Use environment variables for configuration
- Monitor worker execution metrics
- Implement proper error handling

## Troubleshooting

Common issues and solutions:

1. **API Errors**:
   - Check credentials in environment variables
   - Verify API base URLs
   - Ensure account handles are correct

2. **Worker Execution**:
   - Check CPU/Memory limits
   - Verify cron schedule
   - Monitor execution logs

3. **Posting Issues**:
   - Check API permissions
   - Verify environment variables
   - Monitor rate limits

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Based on [Heroku_ebooks](https://github.com/tommeagher/heroku_ebooks/) by [@tommeagher](https://github.com/tommeagher)
- Uses [Cloudflare Workers](https://workers.cloudflare.com/) for serverless execution
