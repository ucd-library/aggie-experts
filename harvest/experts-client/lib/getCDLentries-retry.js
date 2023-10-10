  /**
 * @description Generic function to get all the entries from a CDL collection
 * @param {
  * } opt
  * @returns
  *
  */
  async getCDLentries(opt, query) {
  const cdl = opt.cdl;
  var lastPage = false
  var results = [];
  var nextPage = path.join(cdl.url, query)
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second
  var json = null;


  if (cdl.auth.match(':')) {
    cdl.authBasic = Buffer.from(cdl.auth).toString('base64');
  } else {
    cdl.authBasic = cdl.auth;
  }

  while (nextPage) {
    // console.log(`getting ${nextPage}`);

    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        console.log(`getting ${nextPage}`);
        const response = await fetch(nextPage, {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + cdl.authBasic,
            'Content-Type': 'text/xml'
          }
        })
        console.log(response.status);
        if (!response.ok) {
          // Handle non-successful responses (e.g., status code 4xx or 5xx)
          console.error('Request failed with status:', response.status);

        }
        else if (response.status === 200) {
          // Process the response data here
          const xml = await response.text();
          // convert the xml atom feed to json
          json = parser.toJson(xml, { object: true, arrayNotation: false });

          // add the entries to the results array
          if (json.feed.entry) {
            results = results.concat(json.feed.entry);
          }
          //break; // Successful response, exit the loop
        }
      } catch (error) {
        console.log(error);
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

    // inspect the pagination to see if there are more pages
    const pagination = json.feed['api:pagination'];

    // Fetch the next page
    nextPage = null;

    if (pagination["api:page"] instanceof Array) {
      for (let link of pagination["api:page"]) {
        if (link.position === 'next') {
          nextPage = link.href;
        }
      }
    }

    return results;
  }
}
