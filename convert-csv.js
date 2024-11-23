// Script to convert CSV to text file
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse');

async function convertCsvToText(inputFile, outputFile) {
  let firstRow = true;
  let count = 0;

  const parser = fs
    .createReadStream(inputFile)
    .pipe(csv.parse({ columns: true }));

  const writeStream = fs.createWriteStream(outputFile);
  
  for await (const record of parser) {
    if (firstRow) {
      console.log('Available columns:', Object.keys(record));
      firstRow = false;
    }

    if (record.full_text) {
      // Clean the text: remove URLs, mentions, and normalize whitespace
      const cleanedText = record.full_text
        .replace(/http\S+|www\.\S+/g, '') // Remove URLs
        .replace(/@\S+/g, '') // Remove mentions
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      if (cleanedText) {
        writeStream.write(cleanedText + '\n');
        count++;
        if (count % 1000 === 0) {
          console.log(`Processed ${count} tweets...`);
        }
      }
    }
  }
  
  writeStream.end();
  console.log(`\nConverted ${count} tweets from ${inputFile} to ${outputFile}`);
}

// Check command line arguments
if (process.argv.length !== 4) {
  console.log('Usage: node convert-csv.js <input.csv> <output.txt>');
  process.exit(1);
}

const inputFile = path.resolve(process.argv[2]);
const outputFile = path.resolve(process.argv[3]);

if (!fs.existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

convertCsvToText(inputFile, outputFile);
