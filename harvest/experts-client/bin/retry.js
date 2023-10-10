const fetch = require('node-fetch');

const apiUrl = 'https://api.example.com/data-endpoint';
const maxRetries = 3;
const retryDelay = 1000; // 1 second

async function fetchDataWithRetries() {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch(apiUrl, { timeout: 5000 }); // Set a 5-second timeout
      if (!response.ok) {
        // Handle non-successful responses (e.g., status code 4xx or 5xx)
        console.error('Request failed with status:', response.status);
        break;
      }
      const data = await response.json();
      // Process the response data here
      console.log('Data received:', data);
      return; // Successful response, exit the loop
    } catch (error) {
      if (error.type === 'request-timeout') {
        // Timeout error, retry the request
        console.warn('Request timed out. Retrying...');
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        // Handle other types of errors here
        console.error('Error:', error.message);
        break; // Exit the loop for non-timeout errors
      }
    }
  }

  console.error('Max retries reached. Unable to fetch data.');
}

fetchDataWithRetries();
