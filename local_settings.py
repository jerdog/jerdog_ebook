from os import environ

'''
Local Settings for a heroku_ebooks account.
'''

# Configuration for Twitter API
TWITTER_API_VERSION = 'v2' # Use "1.1" for older API keys.
ENABLE_TWITTER_SOURCES = True # Fetch twitter statuses as source
ENABLE_TWITTER_POSTING = True # Tweet resulting status?
MY_BEARER_TOKEN = environ.get('TWITTER_BEARER_TOKEN') # Your Twitter API Bearer Token
MY_CONSUMER_KEY = environ.get('TWITTER_CONSUMER_KEY')#Your Twitter API Consumer Key set in Heroku config
MY_CONSUMER_SECRET = environ.get('TWITTER_CONSUMER_SECRET')#Your Consumer Secret Key set in Heroku config
MY_ACCESS_TOKEN_KEY = environ.get('TWITTER_ACCESS_TOKEN_KEY')#Your Twitter API Access Token Key set in Heroku config
MY_ACCESS_TOKEN_SECRET = environ.get('TWITTER_ACCESS_SECRET')#Your Access Token Secret set in Heroku config

# Configuration for Mastodon API
ENABLE_MASTODON_SOURCES = True # Fetch mastodon statuses as a source?
ENABLE_MASTODON_POSTING = True # Toot resulting status?
MASTODON_API_BASE_URL = environ.get('MASTODON_API_BASE_URL') # an instance url like https://botsin.space
MASTODON_KEY = environ.get('MASTODON_CLIENT_KEY') # the MASTODON client key you created for this project
MASTODON_SECRET = environ.get('MASTODON_CLIENT_SECRET') # The MASTODON client secret you created for this project
MASTODON_TOKEN = environ.get('MASTODON_ACCESS_TOKEN')

# Configuration for Bluesky API
ENABLE_BLUESKY_SOURCES = True # Fetch Bluesky posts as a source?
ENABLE_BLUESKY_POSTING = True # Post resulting status to Bluesky?
BLUESKY_UID = environ.get('BLUESKY_UID') # Your Bluesky handle (e.g., user.bsky.social)
BLUESKY_PWD = environ.get('BLUESKY_PWD') # Your Bluesky app password

# Sources (Twitter, Mastodon, local text file or a web page)
TWITTER_SOURCE_ACCOUNTS = [""]  # A list of comma-separated, quote-enclosed Twitter handles of account that you'll generate tweets based on. It should look like ["account1", "account2"]. If you want just one account, no comma needed.
TWEETS_TO_GRAB = 500 # APIv2 Specific. How many tweets to grab to train the chain. Note that Twitter APIv2 lets you pull a maximum of 500,000 tweets per month.
MASTODON_SOURCE_ACCOUNTS = environ.get('MASTODON_SOURCE_ACCOUNTS') # A list, e.g. ["@user@instance.tld"]
BLUESKY_SOURCE_ACCOUNTS = environ.get('BLUESKY_SOURCE_ACCOUNTS') # A list, e.g. ["@user@instance.tld"]
SOURCE_EXCLUDE = r'^$'  # Source tweets that match this regexp will not be added to the Markov chain. You might want to filter out inappropriate words for example.
STATIC_TEST = True  # Set this to True if you want to test Markov generation from a static file instead of the API.
TEST_SOURCE = "tweets.txt"  # The name of a text file of a string-ified list for testing. To avoid unnecessarily hitting Twitter API. You can use the included testcorpus.txt, if needed.
SCRAPE_URL = False  # Set this to true to scrape a webpage.
SRC_URL = ['http://www.example.com/one', 'https://www.example.com/two']  # A comma-separated list of URLs to scrape
WEB_CONTEXT = ['span', 'h2']  # A comma-separated list of the tag or object to search for in each page above.
WEB_ATTRIBUTES = [{'class': 'example-text'}, {}] # A list of dictionaries containing the attributes for each page.

ODDS = 8  # How often do you want this to run? 1/8 times?
ORDER = 2  # How closely do you want this to hew to sensical? 2 is low and 4 is high.
DEBUG = True # Set this to False to start posting to Twitter

TWEET_ACCOUNT = ""  # The name of the account you're tweeting to.

#Configuration for Twitter parser. TEST_SOURCE will be re-used as as the corpus location.
TWITTER_ARCHIVE_NAME = "tweets.csv" #Name of your twitter archive
IGNORE_RETWEETS = True #If you want to remove retweets
