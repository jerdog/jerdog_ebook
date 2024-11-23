"""
Markov Chain Text Generator

This module implements a Markov chain text generator that can create new text
based on a corpus of source texts. It uses an nth-order Markov chain where
n is configurable (typically 2-4).

The generator creates a probability distribution of words based on the previous
n words in the source texts, then uses this to generate new text that has
similar patterns to the source material.

Example:
    generator = MarkovGenerator(source_texts, order=2)
    new_text = generator.generate_text()

Author: Jeremy Meiss
Based on: Heroku_ebooks by Tom Meagher
License: MIT
"""

import random
import re


class MarkovGenerator:
    """
    A Markov chain text generator that creates new text based on source material.
    
    The generator builds a probability model of word sequences from the source
    texts, then uses this to generate new text that follows similar patterns.
    
    Attributes:
        order (int): The number of previous words to consider (2-4 recommended)
        model (dict): The Markov chain probability model
    """
    
    def __init__(self, source_texts, order=2):
        """
        Initialize the Markov chain generator.
        
        Args:
            source_texts (list): List of source texts to build the model from
            order (int): The Markov chain order (number of previous words to consider)
        """
        self.order = order
        self.model = {}
        self.beginnings = []
        self._build_model(source_texts)
    
    def _build_model(self, source_texts):
        """
        Build the Markov chain probability model from source texts.
        
        Args:
            source_texts (list): List of texts to process
        """
        for text in source_texts:
            # Clean and tokenize the text
            words = self._tokenize(text)
            if len(words) <= self.order:
                continue
                
            # Add beginning of text
            self.beginnings.append(tuple(words[:self.order]))
                
            # Build the model
            for i in range(len(words) - self.order):
                key = tuple(words[i:i + self.order])
                next_word = words[i + self.order]
                
                if key not in self.model:
                    self.model[key] = []
                self.model[key].append(next_word)
    
    def _tokenize(self, text):
        """
        Clean and tokenize text into words.
        
        Args:
            text (str): Text to tokenize
            
        Returns:
            list: List of words
        """
        # Clean the text
        text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
        text = text.strip()
        
        # Split into words, keeping some punctuation
        words = []
        for word in text.split():
            # Keep sentence-ending punctuation with the word
            if word.endswith(('.', '!', '?')):
                words.append(word)
            else:
                # Remove other punctuation
                word = re.sub(r'[^\w\s]', '', word)
                if word:
                    words.append(word)
        
        return words
    
    def _get_random_start(self):
        """
        Get a random starting sequence for text generation.
        
        Returns:
            tuple: Starting sequence of words
        """
        if not self.beginnings:
            # Fallback to any sequence if no beginnings
            return random.choice(list(self.model.keys()))
        return random.choice(self.beginnings)
    
    def generate_text(self, max_words=50, min_words=10):
        """
        Generate new text using the Markov chain model.
        
        Args:
            max_words (int): Maximum number of words to generate
            min_words (int): Minimum number of words before stopping at punctuation
            
        Returns:
            str: Generated text
        """
        if not self.model:
            return ""
            
        # Start with a random sequence
        current = self._get_random_start()
        result = list(current)
        
        # Generate the text
        for _ in range(max_words - self.order):
            if current not in self.model:
                break
                
            next_word = random.choice(self.model[current])
            result.append(next_word)
            
            # Update current sequence
            current = tuple(result[-self.order:])
            
            # Check for natural ending after minimum length
            if len(result) >= min_words:
                if next_word.endswith(('.', '!', '?')):
                    break
        
        # Ensure the text ends with punctuation
        if not result[-1].endswith(('.', '!', '?')):
            result[-1] = result[-1] + '.'
            
        return ' '.join(result)

# For backward compatibility
class MarkovChainer(MarkovGenerator):
    """Legacy class for backward compatibility"""
    pass

class MarkovChainerLegacy(object):
    """
    A Markov chain text generator that creates new text based on source material.
    
    The generator builds a probability model of word sequences from the source
    texts, then uses this to generate new text that follows similar patterns.
    
    Attributes:
        order (int): The number of previous words to consider (2-4 recommended)
        beginnings (list): List of starting sequences
        freq (dict): The Markov chain probability model
    """
    
    def __init__(self, order):
        """
        Initialize the Markov chain generator.
        
        Args:
            order (int): The Markov chain order (number of previous words to consider)
        """
        self.order = order
        self.beginnings = []
        self.freq = {}

    # pass a string with a terminator to the function to add it to the markov lists.
    def add_sentence(self, string, terminator):
        """
        Add a sentence to the Markov chain model.
        
        Args:
            string (str): Sentence to add
            terminator (str): Terminator character (e.g. '.', '?', '!')
        """
        data = "".join(string)
        words = data.split()
        buf = []
        if len(words) > self.order:
            words.append(terminator)
            self.beginnings.append(words[0:self.order])
        else:
            pass

        for word in words:
            buf.append(word)
            if len(buf) == self.order + 1:
                mykey = (buf[0], buf[-2])
                if mykey in self.freq:
                    self.freq[mykey].append(buf[-1])
                else:
                    self.freq[mykey] = [buf[-1]]
                buf.pop(0)
            else:
                continue
        return

    def add_text(self, text):
        """
        Add a text to the Markov chain model.
        
        Args:
            text (str): Text to add
        """
        text = re.sub(r'\n\s*\n/m', ".", text)
        seps = '([.!?;:])'
        pieces = re.split(seps, text)
        sentence = ""
        for piece in pieces:
            if piece != "":
                if re.search(seps, piece):
                    self.add_sentence(sentence, piece)
                    sentence = ""
                else:
                    sentence = piece

    # Generate the goofy sentences that become your tweet.
    def generate_sentence(self):
        """
        Generate a new sentence using the Markov chain model.
        
        Returns:
            str: Generated sentence
        """
        if not self.beginnings:
            return None
            
        # Choose a random beginning
        res = random.choice(self.beginnings)
        res = res[:]
        
        if len(res) == self.order:
            nw = True
            while nw is not None:
                restup = (res[-2], res[-1])
                try:
                    nw = self.next_word_for(restup)
                    if nw is not None:
                        res.append(nw)
                    else:
                        continue
                except Exception:
                    nw = False
                    
            new_res = res[0:-2]
            if new_res[0].istitle() or new_res[0].isupper():
                pass
            else:
                new_res[0] = new_res[0].capitalize()
            sentence = ""
            for word in new_res:
                sentence += word + " "
            sentence += res[-2] + ("" if res[-1] in ".!?;:" else " ") + res[-1]

        else:
            sentence = None
        return sentence

    def next_word_for(self, words):
        """
        Get the next word in the Markov chain sequence.
        
        Args:
            words (tuple): Current sequence of words
        
        Returns:
            str: Next word in the sequence
        """
        try:
            arr = self.freq[words]
            next_words = random.choice(arr)
            return next_words
        except Exception:
            return None


if __name__ == "__main__":
    print("Try running ebooks.py first")
