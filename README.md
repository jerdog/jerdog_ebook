# Social Media Markov Bot

***Forked from [tommeagher/heroku_ebooks](https://github.com/tommeagher/heroku_ebooks) and modified to work with Bluesky***

A Python-based social media bot that generates and posts content using Markov chain text generation. Currently supports Bluesky and Mastodon platforms.

## Features

- Multi-platform support:
  - Bluesky integration with optimized API usage
  - Mastodon integration with HTML content handling
- Advanced Markov chain text generation:
  - Configurable chain order
  - Improved text cleaning
  - Natural language output
- Flexible source text collection:
  - Static file support
  - Live post retrieval from social platforms
  - Filtered content (no replies, better quality)
- Smart configuration:
  - Environment-based credentials
  - Platform-specific settings
  - Debug and test modes
- Performance optimizations:
  - API client caching
  - Efficient post retrieval
  - Rate limit compliance
- Comprehensive logging:
  - Detailed error reporting
  - Debug output options
  - Operation tracking

## Setup

1. Clone this repo
2. Create a `.env` file based on `.env-sample` with your credentials:
   ```
   ### BlueSky API Keys
   BLUESKY_UID = "your.handle.bsky.social"
   BLUESKY_PWD = "your-app-password"
   BLUESKY_SOURCE_ACCOUNTS = ["source.handle.bsky.social"]

   ### Mastodon API Keys
   MASTODON_CLIENT_KEY = "your-client-key"
   MASTODON_CLIENT_SECRET = "your-client-secret"
   MASTODON_ACCESS_TOKEN = "your-access-token"
   MASTODON_SOURCE_ACCOUNTS = ["@handle@instance.social"]
   MASTODON_API_BASE_URL = "https://your.instance.social"
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure `local_settings.py`:
   ```python
   # Debug Settings
   DEBUG = True  # Set to False for live posting
   STATIC_TEST = True  # Use static file for testing
   
   # Markov Settings
   ODDS = 2  # 1/N chance of posting (2 = 50% chance)
   ORDER = 2  # Chain order (2-4, lower = more random)
   
   # Platform Toggles
   ENABLE_BLUESKY_POSTING = True
   ENABLE_MASTODON_POSTING = True
   ENABLE_BLUESKY_SOURCES = True
   ENABLE_MASTODON_SOURCES = True
   ```

5. Run the bot:
   ```bash
   python ebooks.py
   ```

## Configuration

### Environment Variables
- `BLUESKY_UID`: Your Bluesky handle
- `BLUESKY_PWD`: Your Bluesky app password
- `BLUESKY_SOURCE_ACCOUNTS`: Comma-separated list of Bluesky accounts
- `MASTODON_CLIENT_KEY`: Mastodon client key
- `MASTODON_CLIENT_SECRET`: Mastodon client secret
- `MASTODON_ACCESS_TOKEN`: Mastodon access token
- `MASTODON_API_BASE_URL`: Your Mastodon instance URL
- `MASTODON_SOURCE_ACCOUNTS`: Comma-separated list of Mastodon accounts

### Local Settings
- Debug Options:
  - `DEBUG`: Prevent live posting
  - `STATIC_TEST`: Use static file
  - `TEST_SOURCE`: Static file path
- Markov Parameters:
  - `ODDS`: Posting frequency (1/N)
  - `ORDER`: Chain order (2-4)
- Platform Controls:
  - `ENABLE_BLUESKY_SOURCES`
  - `ENABLE_BLUESKY_POSTING`
  - `ENABLE_MASTODON_SOURCES`
  - `ENABLE_MASTODON_POSTING`

## Text Generation

The bot uses Markov chains to generate text from multiple sources:

1. **Static File**:
   - Default: tweets.txt
   - One post per line
   - No special formatting needed

2. **Bluesky Posts**:
   - Fetches up to 100 recent posts
   - Excludes replies for better quality
   - Removes URLs and mentions

3. **Mastodon Posts**:
   - Retrieves recent toots
   - Handles HTML content
   - Filters boosts and replies

## Development

### Debug Mode
1. Set `DEBUG = True` in `local_settings.py`
2. Run the bot to see:
   - Source text collection
   - Text generation process
   - Would-be posts
   - API interactions

### Testing
1. Use `STATIC_TEST = True` for consistent output
2. Check logs for:
   - API connections
   - Post retrieval
   - Text generation
   - Error handling

### Best Practices
- Start with `DEBUG = True`
- Test with `STATIC_TEST = True`
- Use `ORDER = 2` for more coherent output
- Set reasonable `ODDS` (2-4 recommended)

## Troubleshooting

Common issues and solutions:

1. **API Errors**:
   - Check credentials in `.env`
   - Verify API base URLs
   - Ensure account handles are correct

2. **Text Generation**:
   - Increase `ORDER` for more coherent text
   - Check source text quality
   - Verify file encoding (UTF-8)

3. **Posting Issues**:
   - Confirm `DEBUG = False`
   - Check platform enable flags
   - Verify API permissions

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
- Uses [atproto](https://github.com/bluesky-social/atproto) for Bluesky
- Uses [Mastodon.py](https://github.com/halcy/Mastodon.py) for Mastodon
