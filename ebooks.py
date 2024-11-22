import re
import sys
import random
from mastodon import Mastodon
from atproto import Client
import markov
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import os
import datetime

try:
    # Python 3
    from html.entities import name2codepoint as n2c
    from urllib.request import urlopen
except:
    # Python 2
    from htmlentitydefs import name2codepoint as n2c
    from urllib2 import urlopen

# Load environment variables from .env file
load_dotenv()

from local_settings import *


def connect(type='bluesky'):
    if type == 'mastodon':
        print(f"Mastodon Config:")
        print(f"API Base URL: {MASTODON_API_BASE_URL}")
        print(f"Client Key: {MASTODON_KEY}")
        print(f"Client Secret: {MASTODON_SECRET}")
        print(f"Access Token: {MASTODON_TOKEN}")
        
        if not MASTODON_API_BASE_URL:
            raise ValueError("MASTODON_API_BASE_URL is not set in environment")
            
        return Mastodon(
            client_id=MASTODON_KEY,
            client_secret=MASTODON_SECRET,
            access_token=MASTODON_TOKEN,
            api_base_url=MASTODON_API_BASE_URL
        )
    elif type == 'bluesky':
        print(f"Bluesky Config:")
        print(f"UID: {BLUESKY_UID}")
        print(f"Password: {'*' * len(BLUESKY_PWD) if BLUESKY_PWD else 'Not Set'}")
        
        if not BLUESKY_UID or not BLUESKY_PWD:
            raise ValueError("BLUESKY_UID or BLUESKY_PWD not set in environment")
            
        client = Client()
        client.login(BLUESKY_UID, BLUESKY_PWD)
        return client
    return None


def entity(text):
    if text[:2] == "&#":
        try:
            if text[:3] == "&#x":
                return chr(int(text[3:-1], 16))
            else:
                return chr(int(text[2:-1]))
        except ValueError:
            pass
    else:
        guess = text[1:-1]
        if guess == "quot":
            return '"'
        else:
            return chr(n2c[guess])
    return text

def filter_status(text):
    text = re.sub(r'\b(RT|MT) .+', '', text)  # take out anything after RT or MT
    text = re.sub(r'(\#|@|(h\/t)|(http))\S+', '', text)  # Take out URLs, hashtags, hts, etc.
    text = re.sub(r'\s+', ' ', text)  # collapse consecutive whitespace to single spaces.
    text = re.sub(r'\"|\(|\)', '', text)  # take out quotes.
    text = re.sub(r'\s+\(?(via|says)\s@\w+\)?', '', text)  # remove attribution
    text = re.sub(r'<[^>]*>','', text) #strip out html tags from mastodon posts
    htmlsents = re.findall(r'&\w+;', text)
    for item in htmlsents:
        text = text.replace(item, entity(item))
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def scrape_page(src_url, web_context, web_attributes):
    source_statuses = []
    if not isinstance(src_url, list):
        src_url = [src_url]
    if not isinstance(web_context, list):
        web_context = [web_context]
    if not isinstance(web_attributes, list):
        web_attributes = [web_attributes]
    for url, context, attribute in zip(src_url, web_context, web_attributes):
        print("Scraping {0}".format(url))
        try:
            page = urlopen(url)
        except Exception as e:
            print("Cannot open URL: {0}".format(e))
            continue
        soup = BeautifulSoup(page, 'html.parser')
        soup = soup.find(context, attribute)
        if soup:
            soup = soup.text
            if soup:
                source_statuses += soup.split(".")
        else:
            print("Couldn't find the content")
    return source_statuses

def grab_toots(api, account_handle=None):
    """Retrieve posts from a Mastodon account"""
    if not account_handle:
        return []
    
    try:
        # First, search for the account to get its ID
        print(f"Looking up Mastodon account: {account_handle}")
        # Remove the @ from the start if present
        if account_handle.startswith('@'):
            account_handle = account_handle[1:]
            
        # Split the handle into username and domain
        if '@' in account_handle:
            username, domain = account_handle.split('@')
            if domain != MASTODON_API_BASE_URL.split('://')[-1]:
                print(f"Warning: Account domain {domain} doesn't match API URL {MASTODON_API_BASE_URL}")
        
        accounts = api.account_lookup(account_handle)
        if not accounts:
            print(f"Could not find Mastodon account: {account_handle}")
            return []
            
        account_id = accounts.id
        print(f"Found account ID: {account_id}")
        
        # Now fetch the account's posts
        source_toots = []
        user_toots = api.account_statuses(account_id, exclude_replies=True, exclude_reblogs=True)
        
        for toot in user_toots:
            if toot and hasattr(toot, 'content'):
                content = filter_status(toot.content)
                if content:
                    source_toots.append(content)
        
        print(f"Retrieved {len(source_toots)} toots from {account_handle}")
        return source_toots
    except Exception as e:
        print(f"Error getting Mastodon posts from {account_handle}: {str(e)}")
        return []

def grab_bluesky_posts(api, handle=None):
    """Retrieve posts from a Bluesky account"""
    if not handle:
        return []
        
    try:
        print(f"Looking up Bluesky account: {handle}")
        # Remove @ if present and ensure proper handle format
        if handle.startswith('@'):
            handle = handle[1:]
            
        # Make sure handle has .bsky.social if no domain specified
        if '.' not in handle:
            handle = f"{handle}.bsky.social"
            
        print(f"Formatted handle: {handle}")
        
        # Get the DID first
        profile = api.com.atproto.identity.resolve_handle({'handle': handle})
        if not profile or not profile.did:
            print(f"Could not find Bluesky account: {handle}")
            return []
            
        did = profile.did
        print(f"Found DID: {did}")
        
        # Now get their posts using the timeline endpoint
        feed = api.app.bsky.feed.get_author_feed({
            'actor': did,
            'limit': 100  # Get more posts
        })
        
        if not feed or not hasattr(feed, 'feed'):
            print(f"No posts found for {handle}")
            return []
            
        source_posts = []
        for post in feed.feed:
            if (hasattr(post, 'post') and 
                hasattr(post.post, 'record') and 
                hasattr(post.post.record, 'text')):
                text = post.post.record.text
                # Skip replies and reposts
                if not text.startswith('@') and 'rt' not in text.lower():
                    # Clean up the text
                    text = re.sub(r'https://\S+', '', text)  # Remove URLs
                    text = re.sub(r'@\w+', '', text)  # Remove mentions
                    text = re.sub(r'\s+', ' ', text).strip()  # Clean whitespace
                    if text:  # Only add non-empty posts
                        source_posts.append(text)
                    
        print(f"Retrieved {len(source_posts)} posts from {handle}")
        if DEBUG and source_posts:
            print("Sample posts:")
            for i, post in enumerate(source_posts[:3]):
                print(f"  {i+1}. {post}")
                
        return source_posts
    except Exception as e:
        print(f"Error getting Bluesky posts: {str(e)}")
        if DEBUG:
            import traceback
            traceback.print_exc()
        return []

if __name__ == "__main__":
    if DEBUG:
        print("\n[DEBUG MODE] Running in debug mode - no posts will be made\n")
    
    # Set a random seed based on current time
    random.seed()
    
    print("Retrieving source texts...")
    
    try:
        mastodon_api = connect('mastodon')
        bluesky_api = connect('bluesky')

        source_statuses = []

        # Get tweets from static file if enabled
        if STATIC_TEST:
            print("\nReading from static file:", TEST_SOURCE)
            try:
                with open(TEST_SOURCE, 'r', encoding='utf8') as f:
                    text = f.read()
                    # Split on newlines and clean up each tweet
                    tweets = []
                    for line in text.splitlines():
                        line = line.strip()
                        if line:
                            # Remove the trailing comma and clean up quotes
                            line = line.rstrip(',').strip()
                            if line.startswith("'") and line.endswith("'"):
                                line = line[1:-1]
                            # Remove t.co URLs
                            line = re.sub(r'https://t\.co/\w+', '', line)
                            # Remove mentions for better text generation
                            line = re.sub(r'@\w+', '', line)
                            # Clean up extra whitespace
                            line = re.sub(r'\s+', ' ', line).strip()
                            if line:  # Only add non-empty lines
                                tweets.append(line)
                                
                    print(f"Found {len(tweets)} tweets in {TEST_SOURCE}")
                    if DEBUG:
                        print("\nSample tweets after cleaning:")
                        for i, tweet in enumerate(tweets[:3]):
                            print(f"{i+1}. {tweet}")
                    source_statuses.extend(tweets)
            except Exception as e:
                print(f"Error reading {TEST_SOURCE}: {str(e)}")
        
        # Get posts from Mastodon if enabled
        if ENABLE_MASTODON_SOURCES and mastodon_api and MASTODON_SOURCE_ACCOUNTS:
            print("\nFetching Mastodon posts...")
            mastodon_accounts = MASTODON_SOURCE_ACCOUNTS.strip('[]').replace('"', '').split(',')
            for account_handle in mastodon_accounts:
                if account_handle.strip():
                    source_statuses.extend(grab_toots(mastodon_api, account_handle.strip()))
                    
        # Get posts from Bluesky if enabled
        if ENABLE_BLUESKY_SOURCES and bluesky_api and BLUESKY_SOURCE_ACCOUNTS:
            print("\nFetching Bluesky posts...")
            bluesky_accounts = BLUESKY_SOURCE_ACCOUNTS.strip('[]').replace('"', '').split(',')
            for handle in bluesky_accounts:
                if handle.strip():
                    source_statuses.extend(grab_bluesky_posts(bluesky_api, handle.strip()))

        if len(source_statuses) == 0:
            print("Error: No source texts found!")
            sys.exit(1)

        print(f"\nFound {len(source_statuses)} total source texts")
        if DEBUG:
            print("\nSample of combined source texts:")
            for i, status in enumerate(random.sample(source_statuses, min(3, len(source_statuses)))):
                print(f"{i+1}. {status}")
        
        order = ORDER
        guess = 0
        if ODDS and not DEBUG:
            guess = random.randint(0, ODDS - 1)

        if guess:
            print(str(guess) + " No, sorry, not this time.")  # message if the random number fails.
            sys.exit()
        else:
            mine = markov.MarkovChainer(order)
            for status in source_statuses:
                if not re.search(SOURCE_EXCLUDE, status):
                    mine.add_text(status)

            for x in range(0, 10):
                ebook_status = mine.generate_sentence()

                if ebook_status:
                    # randomly drop the last word, as Horse_ebooks appears to do
                    if random.randint(0, 4) == 0 and re.search(r'(in|to|from|for|with|by|our|of|your|around|under|beyond)\s\w+$', ebook_status) is not None:
                        print("Losing last word randomly")
                        ebook_status = re.sub(r'\s\w+.$', '', ebook_status)

                    # if it's very short, try to add another sentence
                    if len(ebook_status) < 40:
                        print("Short status, trying to add another sentence")
                        second_sentence = mine.generate_sentence()
                        if second_sentence:
                            ebook_status += " " + second_sentence

                    # Remove scary values
                    ebook_status = ebook_status.replace("|", "I")
                    ebook_status = ebook_status.replace("&gt;", ">")
                    ebook_status = ebook_status.replace("&lt;", "<")

                    print("\nGenerated status: " + ebook_status + "\n")
                    
                    if DEBUG:
                        print("[DEBUG MODE] Would have posted to:")
                        if ENABLE_MASTODON_POSTING and mastodon_api:
                            print("- Mastodon")
                        if ENABLE_BLUESKY_POSTING and bluesky_api:
                            print("- Bluesky")
                    else:
                        if ENABLE_MASTODON_POSTING and mastodon_api:
                            try:
                                mastodon_api.toot(ebook_status)
                                print("Posted to Mastodon successfully!")
                            except Exception as e:
                                print(f"Error posting to Mastodon: {str(e)}")
                                
                        if ENABLE_BLUESKY_POSTING and bluesky_api:
                            try:
                                record = {
                                    '$type': 'app.bsky.feed.post',
                                    'text': ebook_status,
                                    'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                                }
                                
                                bluesky_api.com.atproto.repo.create_record({
                                    'repo': bluesky_api.me.did,
                                    'collection': 'app.bsky.feed.post',
                                    'record': record
                                })
                                print("Posted to Bluesky successfully!")
                            except Exception as e:
                                print(f"Error posting to Bluesky: {str(e)}")

                    sys.exit()

    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
