const json2csv = require("json2csv").parse;
const fs = require("fs");
const puppeteer = require("puppeteer");

(async () => {
  const host = "https://stage.experts.library.ucdavis.edu";

  // headless mode doesn't work for sites like scopus.org
  const uaString =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
  const browser = await puppeteer.launch({ headless: false });

  let output = [];
  let experts = [];

  for( const letter of
  [
    "A", "B", "C", 'D', 'E', 'F',
    'G', 'H', 'I', 'J', 'K', 'L',
    'M', 'N', 'O', 'P', 'Q', 'R',
    'S', 'T', 'U', 'V', 'W', 'X', 'Y'
  ] ) {
    console.log("Fetching data for letter: " + letter);
    let page = await browser.newPage();
    await page.setUserAgent(uaString);

    // fetch the browse data for the letter
    let response = await page.goto(`${host}/api/expert/browse?page=1&size=1000&p=${letter}`);

    if (response.ok()) {
      const searchData = await response.json();

      (searchData?.hits || []).forEach((graph) => {
        experts.push({ expertId: graph["@id"] });
      });

      for (const expert of experts) {
        console.log("Fetching data for expert: " + expert.expertId);

        page = await browser.newPage();
        await page.setUserAgent(uaString);

        response = await page.goto(`${host}/api/${expert.expertId}`);

        if (response.ok()) {
          // parse the response to JSON
          const expertData = await response.json();
          let graphRoot = expertData["@graph"]?.[0];

          expert["name"] = graphRoot?.["name"];
          expert["@id"] = graphRoot?.["@id"];
          let sites = [];

          // parse role and link urls that would display in the 'about me' section for each expert
          let roles = graphRoot?.contactInfo
            ?.filter((c) => c["isPreferred"] === true && c.hasURL?.["url"])
            .map((c) => {
              return {
                url: c.hasURL?.["url"],
              };
            });
          roles.forEach((r) => {
            sites.push({ source: "ODR", url: r.url });
          });

          let websites = graphRoot?.contactInfo?.filter(
            (c) =>
              (!c["isPreferred"] || c["isPreferred"] === false) &&
              c["rank"] === 20 &&
              c.hasURL
          );
          websites.forEach((w) => {
            let urls = !Array.isArray(w.hasURL) ? [w.hasURL] : w.hasURL;
            urls.forEach((u) => {
              sites.push({ source: "Elements", url: u.url });
            });
          });

          let orcId = graphRoot?.orcidId;
          let scopusIds = Array.isArray(graphRoot?.scopusId)
            ? graphRoot?.scopusId
            : [graphRoot?.scopusId];
          let researcherId = graphRoot?.researcherId;

          if (orcId)
            sites.push({
              source: "Elements",
              url: `https://orcid.org/${orcId}`,
            });
          if (scopusIds)
            scopusIds.forEach((s) => {
              if (s)
                sites.push({
                  source: "Elements",
                  url: `https://www.scopus.com/authid/detail.uri?authorId=${s}`,
                });
            });
          if (researcherId)
            sites.push({
              source: "Elements",
              url: `https://www.webofscience.com/wos/author/record/${researcherId}`,
            });

          expert["sites"] = sites;
        } else {
          console.log("Failed to fetch data for expert: " + expert.expertId);
        }
        await page.close(); // close the tab
      }
    } else {
      console.log("Failed to fetch browse data for letter: " + letter);
    }
  }

  // test each link
  for (let expert of experts) {
    for (let site of expert.sites || []) {
      console.log("Checking link: " + site.url);
      let page = await browser.newPage();
      await page.setUserAgent(uaString);

      try {
        response = await page.goto(site.url);
        let succeeded = response.ok();

        // scopus.org doesn't throw 404 for not found pages, scrub page text to check for 404
        if (site.url.includes("scopus")) {
          const error404 = await page.evaluate(() => {
            const spans = Array.from(document.querySelectorAll("span"));
            return spans.find((span) =>
              span.textContent.includes("Page not found")
            );
          });
          if (error404) {
            succeeded = false;
            throw new Error();
          }
        }
        output.push({
          url: site.url,
          expertName: expert.name,
          id: expert["@id"],
          resolves: succeeded,
          source: site.source,
        });
      } catch (e) {
        console.log("Failed to fetch data for link: " + site.url);
        output.push({
          url: site.url,
          expertName: expert.name,
          id: expert["@id"],
          resolves: false,
          source: site.source,
        });
      }

      await page.close(); // close the tab
    }
  }

  // output should be csv with the following columns: url, expert name, link resolves, odr vs elements
  console.log({ output });

  // convert JSON to CSV
  const csv = json2csv(output);

  // write CSV to file
  fs.writeFileSync(`output/ae_links_test_${new Date().toISOString().split('T')[0]}.csv`, csv);
  console.log("CSV file has been saved");

  await browser.close();
})();
