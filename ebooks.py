#!/usr/bin/env python3
"""
Social Media Markov Bot

A multi-platform bot that generates and posts content using Markov chain text generation.
Supports Bluesky and Mastodon platforms, with flexible source text collection from
static files and live social media posts.

Features:
- Markov chain text generation
- Multi-platform support (Bluesky, Mastodon)
- Flexible source text collection
- Debug mode for testing
- Configurable post frequency

Author: Jeremy Meiss
Based on: Heroku_ebooks by Tom Meagher
License: MIT
"""

import os
import sys
import time
import re
import random
import logging
from mastodon import Mastodon
from atproto import Client
import markov
from bs4 import BeautifulSoup
import requests
from local_settings import *

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global API clients
mastodon_client = None
bluesky_client = None

def connect(platform):
    """
    Connect to a social media platform's API.
    
    Args:
        platform (str): The platform to connect to ('mastodon' or 'bluesky')
        
    Returns:
        API client object or None if connection fails
    """
    global mastodon_client, bluesky_client
    
    try:
        if platform == 'mastodon' and ENABLE_MASTODON_POSTING:
            if mastodon_client:
                return mastodon_client
                
            if not MASTODON_API_BASE_URL:
                logger.error("Mastodon API base URL is not configured")
                return None
                
            mastodon_client = Mastodon(
                client_id=MASTODON_KEY,
                client_secret=MASTODON_SECRET,
                access_token=MASTODON_TOKEN,
                api_base_url=MASTODON_API_BASE_URL
            )
            return mastodon_client
            
        elif platform == 'bluesky' and ENABLE_BLUESKY_POSTING:
            if bluesky_client:
                return bluesky_client
                
            if not BLUESKY_UID or not BLUESKY_PWD:
                logger.error("Bluesky credentials are not configured")
                return None
                
            client = Client()
            client.login(BLUESKY_UID, BLUESKY_PWD)
            bluesky_client = client
            return client
            
        return None
    except Exception as e:
        logger.error(f"Error connecting to {platform}: {str(e)}")
        if DEBUG:
            import traceback
            traceback.print_exc()
        return None

def grab_toots(api, account_handle):
    """
    Retrieve posts from a Mastodon account.
    
    Args:
        api: Mastodon API client
        account_handle (str): Mastodon account handle (@user@instance)
        
    Returns:
        list: List of post texts
    """
    try:
        logger.info(f"Fetching posts from Mastodon account: {account_handle}")
        
        # Remove brackets and quotes if present
        if isinstance(account_handle, list):
            account_handle = account_handle[0]
        account_handle = account_handle.strip('[]"\' ')
        
        # Remove @ from start if present
        account_handle = account_handle.lstrip('@')
        
        # Get account ID
        account_id = api.account_search(account_handle)[0]['id']
        
        # Get posts
        posts = api.account_statuses(account_id)
        
        # Clean and return post texts
        return [clean_text(post['content']) for post in posts if post['content']]
        
    except Exception as e:
        logger.error(f"Error getting Mastodon posts: {str(e)}")
        return []

def grab_bluesky_posts(api, handle):
    """
    Retrieve posts from a Bluesky account.
    
    Args:
        api: Bluesky API client
        handle (str): Bluesky handle (user.bsky.social)
        
    Returns:
        list: List of post texts
    """
    try:
        logger.info(f"Looking up Bluesky account: {handle}")
        
        # Clean up handle
        if isinstance(handle, list):
            handle = handle[0]
        handle = handle.strip('[]"\' ')
        
        logger.info(f"Formatted handle: {handle}")
        
        # Resolve DID
        response = api.com.atproto.identity.resolve_handle({'handle': handle})
        did = response.did
        
        # Get posts (limit to 100 as per API restriction)
        posts = []
        response = api.app.bsky.feed.get_author_feed({
            'actor': did,
            'limit': 100,  # Maximum allowed by API
            'filter': 'posts_no_replies'  # Exclude replies for better source text
        })
        
        if hasattr(response, 'feed'):
            for post in response.feed:
                if (hasattr(post, 'post') and 
                    hasattr(post.post, 'record') and 
                    hasattr(post.post.record, 'text')):
                    text = clean_text(post.post.record.text)
                    if text:  # Only add non-empty texts
                        posts.append(text)
                    
        logger.info(f"Retrieved {len(posts)} posts from {handle}")
        return posts
        
    except Exception as e:
        logger.error(f"Error getting Bluesky posts: {str(e)}")
        if DEBUG:
            import traceback
            traceback.print_exc()
        return []

def clean_text(text):
    """
    Clean up post text by removing URLs, mentions, and extra whitespace.
    
    Args:
        text (str): Text to clean
        
    Returns:
        str: Cleaned text
    """
    # Remove URLs
    text = re.sub(r'https?://\S+', '', text)
    # Remove mentions
    text = re.sub(r'@\w+', '', text)
    # Clean whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def generate_post():
    """
    Generate a new post using Markov chain text generation.
    
    Returns:
        str: Generated post text
    """
    if DEBUG:
        logger.info("\nGenerating post...")
        
    # Initialize random seed
    random.seed(time.time())
    
    try:
        # Connect to platforms
        mastodon_api = connect('mastodon')
        bluesky_api = connect('bluesky')
        
        source_statuses = []
        
        # Get posts from all enabled sources
        if STATIC_TEST:
            logger.info(f"\nReading from static file: {TEST_SOURCE}")
            try:
                with open(TEST_SOURCE, 'r', encoding='utf8') as f:
                    text = f.read()
                    tweets = []
                    for line in text.splitlines():
                        line = line.strip()
                        if line:
                            line = line.rstrip(',').strip("'")
                            line = clean_text(line)
                            if line:
                                tweets.append(line)
                                
                    logger.info(f"Found {len(tweets)} posts in {TEST_SOURCE}")
                    if DEBUG:
                        logger.debug("\nSample posts:")
                        for i, tweet in enumerate(tweets[:3]):
                            logger.debug(f"{i+1}. {tweet}")
                    source_statuses.extend(tweets)
            except Exception as e:
                logger.error(f"Error reading {TEST_SOURCE}: {str(e)}")
                
        # Get Mastodon posts
        if ENABLE_MASTODON_SOURCES and mastodon_api and MASTODON_SOURCE_ACCOUNTS:
            logger.info("\nFetching Mastodon posts...")
            for account in MASTODON_SOURCE_ACCOUNTS:
                if account.strip():
                    source_statuses.extend(grab_toots(mastodon_api, account.strip()))
                    
        # Get Bluesky posts
        if ENABLE_BLUESKY_SOURCES and bluesky_api and BLUESKY_SOURCE_ACCOUNTS:
            logger.info("\nFetching Bluesky posts...")
            for handle in BLUESKY_SOURCE_ACCOUNTS:
                if handle.strip():
                    source_statuses.extend(grab_bluesky_posts(bluesky_api, handle.strip()))
                    
        if not source_statuses:
            logger.error("Error: No source texts found!")
            return None
            
        logger.info(f"\nFound {len(source_statuses)} total source texts")
        
        # Generate new text
        generator = markov.MarkovGenerator(source_statuses, ORDER)
        generated = generator.generate_text()
        
        if DEBUG:
            logger.debug(f"\nGenerated text: {generated}")
            
        return generated
        
    except Exception as e:
        logger.error(f"Error generating post: {str(e)}")
        if DEBUG:
            import traceback
            traceback.print_exc()
        return None

def post_text(text, platform_api, platform_name):
    """
    Post text to a social media platform.
    
    Args:
        text (str): Text to post
        platform_api: Platform API client
        platform_name (str): Platform name for logging
        
    Returns:
        bool: True if post was successful
    """
    if not text or not platform_api:
        return False
        
    try:
        if platform_name == 'mastodon':
            if not hasattr(platform_api, 'status_post'):
                logger.error("Invalid Mastodon API client")
                return False
            platform_api.status_post(text)
        elif platform_name == 'bluesky':
            if not hasattr(platform_api, 'me') or not platform_api.me:
                logger.error("Not logged in to Bluesky")
                return False
                
            # Create post record
            record = {
                '$type': 'app.bsky.feed.post',
                'text': text,
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'langs': ['en']
            }
            
            platform_api.com.atproto.repo.create_record({
                'repo': platform_api.me.did,
                'collection': 'app.bsky.feed.post',
                'record': record
            })
            
        logger.info(f"Posted to {platform_name}: {text}")
        return True
    except Exception as e:
        logger.error(f"Error posting to {platform_name}: {str(e)}")
        if DEBUG:
            import traceback
            traceback.print_exc()
        return False

def main():
    """Main function to run the bot."""
    if DEBUG:
        logger.info("\n[DEBUG MODE] Running in debug mode - no posts will be made\n")
        
    # Random chance of running
    if ODDS and not DEBUG:
        if random.randint(0, ODDS - 1) == 0:  # 1/N chance of running
            logger.info("Running this time!")
        else:
            logger.info("Not running this time")
            return
            
    # Generate post
    text = generate_post()
    if not text:
        logger.error("Failed to generate post")
        return
        
    # Post to platforms
    if not DEBUG:
        if ENABLE_MASTODON_POSTING:
            mastodon_api = connect('mastodon')
            if mastodon_api:
                post_text(text, mastodon_api, 'mastodon')
            
        if ENABLE_BLUESKY_POSTING:
            bluesky_api = connect('bluesky')
            if bluesky_api:
                post_text(text, bluesky_api, 'bluesky')
    else:
        logger.info("[DEBUG] Would have posted:")
        logger.info(text)

if __name__ == "__main__":
    main()
