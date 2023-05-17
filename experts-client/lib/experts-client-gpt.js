import fs from 'fs';
import fetch from 'node-fetch';

export async function createDataset(datasetName, fusekiUrl, username, password) {
    
    const auth = {
        user: username,
        pass: password,
      };
    
      const url = `${fusekiUrl}/$/datasets`;
      const body = new URLSearchParams({
        dbName: datasetName,
        dbType: 'tdb2',
      });
    
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString('base64')}`,
        },
        body,
      };
    
      const response = await fetch(url, options);
    
      if (!response.ok) {
        throw new Error(`Failed to create dataset. Status code: ${response.status}`);
      }
    
      return await response.text();
    }
    

export async function createGraphFromJsonLdFile(datasetName, graphName, jsonLdFilePath, fusekiUrl, username, password) {
  // Read JSON-LD file from file system
  const jsonLdFileContent = fs.readFileSync(jsonLdFilePath, 'utf-8');

  // Construct URL for uploading the data to the graph
  // Don't include a graphname to use what's in the jsonld file
  const url = `${fusekiUrl}/${datasetName}/data`;
//   const url = `${fusekiUrl}/${datasetName}/data?graph=${graphName}`;

  // Set authentication options
  const auth = {
    user: username,
    pass: password,
  };

  // Set request options
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ld+json',
      'Authorization': `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString('base64')}`,
    },
    body: jsonLdFileContent,
  };

  // Send the request to upload the data to the graph
  console.log(url);
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Failed to create graph. Status code: ${response.status}`);
  }

  return await response.text();
}
