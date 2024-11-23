// Script to add training data to KV namespace
const fs = require('fs');
const path = require('path');

async function addTrainingData(filePath) {
  try {
    // Read the file
    const text = fs.readFileSync(filePath, 'utf8');
    
    // Split into lines and clean them
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('RT '));
    
    console.log(`Found ${lines.length} lines of training data`);
    
    // Start wrangler dev
    console.log('Starting wrangler dev...');
    const workerProcess = require('child_process').spawn('npx', ['wrangler', 'dev'], {
      stdio: ['inherit', 'pipe', 'inherit']
    });
    
    // Wait for worker URL
    let workerUrl = '';
    workerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match && !workerUrl) {
        workerUrl = match[0];
        console.log(`Worker running at ${workerUrl}`);
        uploadData(workerUrl, lines);
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function uploadData(workerUrl, lines) {
  console.log(`\nUploading ${lines.length} lines...`);
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: line })
      });
      
      if (response.ok) {
        success++;
      } else {
        failed++;
        console.error(`Failed to upload: ${line.substring(0, 50)}...`);
      }

      // Show progress every 100 lines
      if ((i + 1) % 100 === 0) {
        console.log(`Progress: ${i + 1}/${lines.length} lines (${Math.round((i + 1) / lines.length * 100)}%)`);
      }
    } catch (error) {
      failed++;
      console.error(`Error uploading: ${error.message}`);
    }
  }
  
  console.log(`\nUpload complete:
- Successfully uploaded: ${success} lines
- Failed to upload: ${failed} lines`);
  
  process.exit(0);
}

// Check command line arguments
if (process.argv.length !== 3) {
  console.log('Usage: node add-training-data.js <path-to-text-file>');
  process.exit(1);
}

const filePath = path.resolve(process.argv[2]);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

addTrainingData(filePath);
