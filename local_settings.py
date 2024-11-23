"""
Local settings for the ebooks bot.

This module contains all the configuration settings for the bot, including:
- Debug settings
- Markov chain parameters
- Platform-specific settings
- API credentials

All sensitive information should be stored in environment variables.
"""

import os
from os import environ
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Debug Settings
DEBUG = False  # Set to False to enable live posting
STATIC_TEST = True  # Set to True to use static file as text source
TEST_SOURCE = "tweets.txt"  # Source file for static testing

# Markov Chain Settings
ODDS = 2  # 1/N chance of running each time (set to 1 to run every time)
ORDER = 2  # Size of word groupings

# Platform Enable Flags
ENABLE_BLUESKY_POSTING = True
ENABLE_MASTODON_POSTING = True
ENABLE_BLUESKY_SOURCES = True
ENABLE_MASTODON_SOURCES = True

# Bluesky Settings
BLUESKY_UID = environ.get('BLUESKY_UID')
BLUESKY_PWD = environ.get('BLUESKY_PWD')
BLUESKY_SOURCE_ACCOUNTS = environ.get('BLUESKY_SOURCE_ACCOUNTS', '').split(',') if environ.get('BLUESKY_SOURCE_ACCOUNTS') else []

# Mastodon Settings
MASTODON_KEY = environ.get('MASTODON_CLIENT_KEY')
MASTODON_SECRET = environ.get('MASTODON_CLIENT_SECRET')
MASTODON_TOKEN = environ.get('MASTODON_ACCESS_TOKEN')
MASTODON_API_BASE_URL = environ.get('MASTODON_API_BASE_URL')
MASTODON_SOURCE_ACCOUNTS = environ.get('MASTODON_SOURCE_ACCOUNTS', '').split(',') if environ.get('MASTODON_SOURCE_ACCOUNTS') else []

# Source Text Settings
SOURCE_ACCOUNT = environ.get('SOURCE_ACCOUNT', '')  # Legacy support

# Twitter Archive Settings (for importing old tweets)
TWITTER_ARCHIVE_NAME = "tweets.csv"  # Name of Twitter archive file
IGNORE_RETWEETS = True  # Skip retweets when parsing archive

# Web Scraping Settings (if needed)
SCRAPE_URL = False  # Enable web scraping
SRC_URL = ['http://www.example.com/one', 'https://www.example.com/two']  # A comma-separated list of URLs to scrape
WEB_CONTEXT = ['span', 'h2']  # HTML elements to extract
WEB_ATTRIBUTES = [{'class': 'example-text'}, {}] # A list of dictionaries containing the attributes for each page.

# Twitter Settings
TWITTER_API_VERSION = 'v2' # Use "1.1" for older API keys.
ENABLE_TWITTER_SOURCES = True # Fetch twitter statuses as source
ENABLE_TWITTER_POSTING = True # Tweet resulting status?
MY_BEARER_TOKEN = environ.get('TWITTER_BEARER_TOKEN') # Your Twitter API Bearer Token
MY_CONSUMER_KEY = environ.get('TWITTER_CONSUMER_KEY')#Your Twitter API Consumer Key set in Heroku config
MY_CONSUMER_SECRET = environ.get('TWITTER_CONSUMER_SECRET')#Your Consumer Secret Key set in Heroku config
MY_ACCESS_TOKEN_KEY = environ.get('TWITTER_ACCESS_TOKEN_KEY')#Your Twitter API Access Token Key set in Heroku config
MY_ACCESS_TOKEN_SECRET = environ.get('TWITTER_ACCESS_SECRET')#Your Access Token Secret set in Heroku config

# Sources (Twitter, Mastodon, local text file or a web page)
TWITTER_SOURCE_ACCOUNTS = [""]  # A list of comma-separated, quote-enclosed Twitter handles of account that you'll generate tweets based on. It should look like ["account1", "account2"]. If you want just one account, no comma needed.
TWEETS_TO_GRAB = 500 # APIv2 Specific. How many tweets to grab to train the chain. Note that Twitter APIv2 lets you pull a maximum of 500,000 tweets per month.
SOURCE_EXCLUDE = r'^$'  # Source tweets that match this regexp will not be added to the Markov chain. You might want to filter out inappropriate words for example.

# Tweet Account
TWEET_ACCOUNT = ""  # The name of the account you're tweeting to.
