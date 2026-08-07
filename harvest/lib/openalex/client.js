import fetch from 'node-fetch';

const BASE_URL = 'https://api.openalex.org/works/doi:';

async function fetchWorkByDoi(doi, { mailto, apiKey } = {}) {
  const url = new URL(BASE_URL + encodeURIComponent(doi));
  if (apiKey) {
    url.searchParams.set('api_key', apiKey);
  } else if (mailto) {
    url.searchParams.set('mailto', mailto);
  }

  const resp = await fetch(url.toString());
  const status = resp.status;
  let json = null;
  if (status === 200) {
    json = await resp.json();
  }
  return { status, json };
}

export { fetchWorkByDoi };
