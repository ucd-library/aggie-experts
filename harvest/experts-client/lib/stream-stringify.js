const { Readable } = require('stream');

// Define your array of JSON objects
const jsonArray = [
  { key1: 'value1', key2: 'value2' },
  { key1: 'value3', key2: 'value4' },
  // ... other objects
];

// Create a custom Readable stream
const objectStream = new Readable({
  objectMode: true, // Set objectMode to true if you are working with objects
  read() {
    if (jsonArray.length === 0) {
      this.push(null); // Signal the end of the stream
    } else {
      this.push(jsonArray.shift()); // Push the next JSON object from the array
    }
  },
});

// Create a JSONStream parser
const JSONStream = require('JSONStream');
const jsonStream = JSONStream.parse('*');

// Handle parsed JSON objects as they are emitted
jsonStream.on('data', (data) => {
  // Process each JSON object here
  console.log('Received JSON object:', data);
});

// Handle errors and end of input stream
objectStream.pipe(jsonStream);

// Optionally, listen for 'end' and 'error' events on the jsonStream
jsonStream.on('end', () => {
  console.log('Stream ended.');
});

jsonStream.on('error', (error) => {
  console.error('Error:', error.message);
});
