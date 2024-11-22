# Social Media Markov Bot

***Forked from [tommeagher/heroku_ebooks](https://github.com/tommeagher/heroku_ebooks) and modified to work with Bluesky***

A Python-based social media bot that generates and posts content using Markov chain text generation. Currently supports Bluesky and Mastodon platforms.

## Features

- Multi-platform support:
  - Bluesky integration
  - Mastodon integration
- Markov chain text generation
- Flexible source text collection:
  - Static file support
  - Live post retrieval from social platforms
- Environment-based configuration
- Debug mode for testing
- Configurable post frequency

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

3. Configure `local_settings.py`:
   - Set `DEBUG = True` for testing (no live posts)
   - Adjust `ODDS` for post frequency
   - Set `ORDER` for text generation (2-4, lower = more random)
   - Enable/disable platforms with `ENABLE_*_SOURCES` and `ENABLE_*_POSTING`

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Run the bot:
   ```bash
   python ebooks.py
   ```

## Configuration Options

### Environment Variables
- `BLUESKY_UID`: Your Bluesky handle
- `BLUESKY_PWD`: Your Bluesky app password
- `BLUESKY_SOURCE_ACCOUNTS`: List of Bluesky accounts to source text from
- `MASTODON_*`: Mastodon credentials and configuration
- See `.env-sample` for all options

### Local Settings
- `DEBUG`: Enable debug mode (no live posting)
- `STATIC_TEST`: Use static file for text source
- `TEST_SOURCE`: Path to static text file
- `ODDS`: How often to post (1/N chance)
- `ORDER`: Markov chain order (2-4)
- Platform toggles:
  - `ENABLE_BLUESKY_SOURCES`
  - `ENABLE_BLUESKY_POSTING`
  - `ENABLE_MASTODON_SOURCES`
  - `ENABLE_MASTODON_POSTING`

## Text Sources

The bot can collect text from multiple sources:
1. Static file (tweets.txt)
2. Bluesky posts
3. Mastodon toots

Enable/disable sources using the configuration options above.

## Development

- Set `DEBUG = True` in `local_settings.py`
- Posts will be generated but not published
- Detailed debug output will show text sources and generated content

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

Based on the original [Heroku_ebooks](https://github.com/tommeagher/heroku_ebooks/) project by [@tommeagher](https://github.com/tommeagher).
