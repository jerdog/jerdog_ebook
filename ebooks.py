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

def connect(platform):
    """
    Connect to a social media platform's API.
    
    Args:
        platform (str): The platform to connect to ('mastodon' or 'bluesky')
        
    Returns:
        API client object or None if connection fails
    """
    try:
        if platform == 'mastodon' and ENABLE_MASTODON_POSTING:
            return Mastodon(
                access_token=MASTODON_TOKEN,
                api_base_url=MASTODON_API_BASE_URL
            )
        elif platform == 'bluesky' and ENABLE_BLUESKY_POSTING:
            return Client(BLUESKY_UID, BLUESKY_PWD)
        return None
    except Exception as e:
        logger.error(f"Error connecting to {platform}: {str(e)}")
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
        # Strip @ from handle if present
        if account_handle.startswith('@'):
            account_handle = account_handle[1:]
            
        logger.info(f"Fetching posts from Mastodon account: {account_handle}")
        
        # Get account ID
        account = api.account_lookup(account_handle)
        if not account:
            logger.error(f"Could not find Mastodon account: {account_handle}")
            return []
            
        # Get posts
        posts = api.account_statuses(account.id, limit=40)
        source_posts = []
        
        for post in posts:
            if post.content:
                # Clean up the HTML content
                text = BeautifulSoup(post.content, 'html.parser').get_text()
                # Skip replies and boosts
                if not text.startswith('@') and not hasattr(post, 'reblog'):
                    # Clean up the text
                    text = clean_text(text)
                    if text:
                        source_posts.append(text)
                        
        logger.info(f"Retrieved {len(source_posts)} posts from {account_handle}")
        return source_posts
        
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
    if not handle:
        return []
        
    try:
        logger.info(f"Looking up Bluesky account: {handle}")
        
        # Remove @ if present and ensure proper handle format
        if handle.startswith('@'):
            handle = handle[1:]
        if '.' not in handle:
            handle = f"{handle}.bsky.social"
            
        logger.info(f"Formatted handle: {handle}")
        
        # Get the DID first
        profile = api.com.atproto.identity.resolve_handle({'handle': handle})
        if not profile or not profile.did:
            logger.error(f"Could not find Bluesky account: {handle}")
            return []
            
        did = profile.did
        logger.info(f"Found DID: {did}")
        
        # Get their posts
        feed = api.app.bsky.feed.get_author_feed({
            'actor': did,
            'limit': 100
        })
        
        if not feed or not hasattr(feed, 'feed'):
            logger.error(f"No posts found for {handle}")
            return []
            
        source_posts = []
        for post in feed.feed:
            if (hasattr(post, 'post') and 
                hasattr(post.post, 'record') and 
                hasattr(post.post.record, 'text')):
                text = post.post.record.text
                # Skip replies and reposts
                if not text.startswith('@') and 'rt' not in text.lower():
                    text = clean_text(text)
                    if text:
                        source_posts.append(text)
                    
        logger.info(f"Retrieved {len(source_posts)} posts from {handle}")
        if DEBUG and source_posts:
            logger.debug("Sample posts:")
            for i, post in enumerate(source_posts[:3]):
                logger.debug(f"  {i+1}. {post}")
                
        return source_posts
        
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
            platform_api.status_post(text)
        elif platform_name == 'bluesky':
            platform_api.com.atproto.repo.create_record({
                'repo': platform_api.me.did,
                'collection': 'app.bsky.feed.post',
                'record': {
                    'text': text,
                    'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                }
            })
        logger.info(f"Posted to {platform_name}: {text}")
        return True
    except Exception as e:
        logger.error(f"Error posting to {platform_name}: {str(e)}")
        return False

def main():
    """Main function to run the bot."""
    if DEBUG:
        logger.info("\n[DEBUG MODE] Running in debug mode - no posts will be made\n")
        
    # Random chance of running
    if ODDS and not DEBUG:
        if random.randint(0, ODDS - 1) != 0:
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
            post_text(text, mastodon_api, 'mastodon')
            
        if ENABLE_BLUESKY_POSTING:
            bluesky_api = connect('bluesky')
            post_text(text, bluesky_api, 'bluesky')
    else:
        logger.info("[DEBUG] Would have posted:")
        logger.info(text)

if __name__ == "__main__":
    main()
