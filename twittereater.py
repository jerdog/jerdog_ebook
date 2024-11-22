# -*- coding: utf-8 -*-
import csv
from local_settings import TWITTER_ARCHIVE_NAME, TEST_SOURCE, IGNORE_RETWEETS

print(f"Reading tweets from {TWITTER_ARCHIVE_NAME}")
print(f"Writing to {TEST_SOURCE}")

try:
    with open(TWITTER_ARCHIVE_NAME, 'r', encoding='utf8', errors='ignore') as f:
        reader = csv.DictReader(f, quotechar='"')
        tweets = []
        
        # Open output file
        with open(TEST_SOURCE, 'w', encoding='utf8') as tweetarchive:
            tweet_count = 0
            retweet_count = 0
            
            for row in reader:
                # Check if this is a retweet (starts with RT)
                is_retweet = row.get('full_text', '').startswith('RT @')
                
                if IGNORE_RETWEETS and is_retweet:
                    retweet_count += 1
                    continue
                    
                # Get the tweet text
                tweet_text = row.get('full_text', '').strip()
                if tweet_text:
                    # Clean up the text and write it
                    tweet_text = tweet_text.replace("'", "\\'")  # Escape single quotes
                    tweetarchive.write(f"'{tweet_text}',\n")
                    tweet_count += 1
            
            print(f"\nProcessed {tweet_count + retweet_count} tweets:")
            print(f"- {tweet_count} tweets written to {TEST_SOURCE}")
            if IGNORE_RETWEETS:
                print(f"- {retweet_count} retweets ignored")
            
except Exception as e:
    print(f"Error processing tweets: {str(e)}")
