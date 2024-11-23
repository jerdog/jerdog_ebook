"""
Configuration settings for the Social Media Markov Bot.

This file contains all the configuration settings for the bot, including:
- Debug and test settings
- Platform-specific settings for Bluesky and Mastodon
- Text source configuration
- Markov chain parameters
"""

from os import environ

# Debug Settings
DEBUG = True  # Set to False to enable live posting
STATIC_TEST = True  # Set to True to use static file as text source
TEST_SOURCE = "tweets.txt"  # Source file for static testing

# Markov Chain Settings
ODDS = 8  # 1/N chance of running each time (set to 1 to run every time)
ORDER = 2  # Markov chain order (2-4, lower = more random)

# Configuration for Twitter API
TWITTER_API_VERSION = 'v2' # Use "1.1" for older API keys.
ENABLE_TWITTER_SOURCES = True # Fetch twitter statuses as source
ENABLE_TWITTER_POSTING = True # Tweet resulting status?
MY_BEARER_TOKEN = environ.get('TWITTER_BEARER_TOKEN') # Your Twitter API Bearer Token
MY_CONSUMER_KEY = environ.get('TWITTER_CONSUMER_KEY')#Your Twitter API Consumer Key set in Heroku config
MY_CONSUMER_SECRET = environ.get('TWITTER_CONSUMER_SECRET')#Your Consumer Secret Key set in Heroku config
MY_ACCESS_TOKEN_KEY = environ.get('TWITTER_ACCESS_TOKEN_KEY')#Your Twitter API Access Token Key set in Heroku config
MY_ACCESS_TOKEN_SECRET = environ.get('TWITTER_ACCESS_SECRET')#Your Access Token Secret set in Heroku config

# Platform Settings
ENABLE_BLUESKY_SOURCES = True  # Enable fetching posts from Bluesky
ENABLE_BLUESKY_POSTING = True  # Enable posting to Bluesky
BLUESKY_UID = environ.get('BLUESKY_UID') # Your Bluesky handle (e.g., user.bsky.social)
BLUESKY_PWD = environ.get('BLUESKY_PWD') # Your Bluesky app password

ENABLE_MASTODON_SOURCES = True  # Enable fetching posts from Mastodon
ENABLE_MASTODON_POSTING = True  # Enable posting to Mastodon
MASTODON_API_BASE_URL = environ.get('MASTODON_API_BASE_URL') # an instance url like https://botsin.space
MASTODON_KEY = environ.get('MASTODON_CLIENT_KEY') # the MASTODON client key you created for this project
MASTODON_SECRET = environ.get('MASTODON_CLIENT_SECRET') # The MASTODON client secret you created for this project
MASTODON_TOKEN = environ.get('MASTODON_ACCESS_TOKEN')

# Sources (Twitter, Mastodon, local text file or a web page)
TWITTER_SOURCE_ACCOUNTS = [""]  # A list of comma-separated, quote-enclosed Twitter handles of account that you'll generate tweets based on. It should look like ["account1", "account2"]. If you want just one account, no comma needed.
TWEETS_TO_GRAB = 500 # APIv2 Specific. How many tweets to grab to train the chain. Note that Twitter APIv2 lets you pull a maximum of 500,000 tweets per month.
MASTODON_SOURCE_ACCOUNTS = environ.get('MASTODON_SOURCE_ACCOUNTS') # A list, e.g. ["@user@instance.tld"]
BLUESKY_SOURCE_ACCOUNTS = environ.get('BLUESKY_SOURCE_ACCOUNTS') # A list, e.g. ["@user@instance.tld"]
SOURCE_EXCLUDE = r'^$'  # Source tweets that match this regexp will not be added to the Markov chain. You might want to filter out inappropriate words for example.

# Web Scraping Settings (if needed)
SCRAPE_URL = False  # Enable web scraping
SRC_URL = ['http://www.example.com/one', 'https://www.example.com/two']  # A comma-separated list of URLs to scrape
WEB_CONTEXT = ['span', 'h2']  # HTML elements to extract
WEB_ATTRIBUTES = [{'class': 'example-text'}, {}] # A list of dictionaries containing the attributes for each page.

# Twitter Archive Settings (for importing old tweets)
TWITTER_ARCHIVE_NAME = "tweets.csv"  # Name of Twitter archive file
IGNORE_RETWEETS = True  # Skip retweets when parsing archive

TWEET_ACCOUNT = ""  # The name of the account you're tweeting to.
