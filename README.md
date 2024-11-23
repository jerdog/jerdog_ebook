# Social Media Markov Bot

***Forked from [tommeagher/heroku_ebooks](https://github.com/tommeagher/heroku_ebooks) and modified for Bluesky and Mastodon***

A Cloudflare Workers-based social media bot that generates and posts content using Markov chain text generation. Currently supports Bluesky and Mastodon platforms.

## Features

- Multi-platform support:
  - Bluesky integration with optimized API usage
  - Mastodon integration with HTML content handling
- Advanced Markov chain text generation:
  - Order-2 Markov chains for natural text flow
  - Sophisticated text cleaning
  - Natural language output
- Training data management:
  - KV storage for training corpus
  - CSV to text conversion utilities
  - Automatic text cleaning and filtering
- Smart scheduling:
  - 2-hour posting intervals
  - 50% posting probability
  - Rate limit compliance
- Serverless architecture:
  - Cloudflare Workers runtime
  - KV namespace storage
  - Minimal resource usage

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

6. Process and upload training data:
   ```bash
   # Convert CSV to text
   node convert-csv.js

   # Upload to KV namespace
   node add-training-data.js
   ```

7. Deploy:
   ```bash
   wrangler deploy
   ```

## Training Data

The bot uses two types of training data:

1. **Static Training Corpus**:
   - Stored in Cloudflare KV
   - Processed from tweets.csv
   - Cleaned and filtered text
   - No URLs, mentions, or retweets

2. **Dynamic Source Posts**:
   - Live posts from Bluesky/Mastodon
   - Filtered for quality
   - HTML content handling
   - Automatic text cleaning

### Processing Training Data

Two utility scripts handle training data:

1. `convert-csv.js`:
   - Converts tweets.csv to clean text
   - Removes URLs and mentions
   - Filters out retweets
   - Normalizes whitespace

2. `add-training-data.js`:
   - Uploads processed text to KV
   - Handles large datasets
   - Progress reporting
   - Error handling

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
- KV namespace binding
- Cron schedule (every 2 hours)
- Compatibility date
- Environment variables

## Text Generation

The bot uses order-2 Markov chains with multiple data sources:

1. **Training Corpus**:
   - Stored in KV namespace
   - Pre-processed for quality
   - Large dataset for variety

2. **Live Platform Posts**:
   - Bluesky posts from source accounts
   - Mastodon toots from source accounts
   - Real-time content integration

### Generation Process
1. Combines KV training data with live posts
2. Builds Markov chain with order 2
3. Generates text with max length limit
4. Posts to both platforms if probability check passes

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
- Process training data before upload
- Monitor worker execution metrics
- Implement proper error handling

## Troubleshooting

Common issues and solutions:

1. **Training Data**:
   - Check CSV format
   - Verify KV namespace binding
   - Monitor upload progress

2. **API Errors**:
   - Check credentials
   - Verify API base URLs
   - Ensure account handles are correct

3. **Worker Execution**:
   - Check cron schedule
   - Verify KV access
   - Monitor execution logs

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
