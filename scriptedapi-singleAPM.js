// Scripted API Code APM Agent Version Check for a specific APM Agent Language
// Update the AgentType var as required
// Import the https module
var https = require("https");

// New Relic API key (replace with your actual API key)
var apiKey = $secure.MYNR_API_KEY;

// New Relic account ID (replace with your actual account ID)
var accountId = $secure.MYACCOUNT_ID;

// Define variables to hold the agent type, count of out-of-date agents, and the date when the check was performed
var agentType = "NODEJS"; // Set the agent type
var currentDate = new Date().toISOString(); // Get the current date in ISO format

// Define GraphQL queries
var DocsAgentQuery = `
  query {
    docs {
      agentReleases(agentName: ${agentType}) {
        date
        version
      }
    }
  }
`;

var apmAgentQuery = `
  {
    actor {
      nrql(
        query: "SELECT uniqueCount(apmAppId) FROM NrDailyUsage WHERE apmLanguage = '${agentType.toLowerCase()}' SINCE 1 MONTH AGO FACET apmAgentVersion"
        accounts: ${accountId}
      ) {
        results
      }
    }
  }
`;

// Function to make the NerdGraph API request
function makeNerdGraphRequest(options, query, callback) {
  var req = https.request(options, function(res) {
    var responseBody = "";

    res.on("data", function(chunk) {
      responseBody += chunk;
    });

    res.on("end", function() {
      try {
        var jsonData = JSON.parse(responseBody);
        callback(null, jsonData);
      } catch (error) {
        callback(error, null);
      }
    });
  });

  req.on("error", function(error) {
    callback(error, null);
  });

  req.write(JSON.stringify({ query: query }));
  req.end();
}

// Function to set synthetic monitoring custom attributes
function setSyntheticCustomAttributes(agentType, countOfOutdatedAgents, checkDate) {
  if (countOfOutdatedAgents > 0) {
    try {
      $util.insights.set("AgentType", agentType);
      $util.insights.set("CountOfOutdatedAgents", countOfOutdatedAgents);
      $util.insights.set("CheckDate", checkDate);
      console.log("Custom Synthetic Attributes added to NRQL");
    } catch (error) {
      console.error("Error adding custom synthetic attributes to NRQL:", error);
    }
  }
}

// Make the NerdGraph API request to get the list of agent versions
makeNerdGraphRequest({ // Docs Agent
  method: "POST",
  hostname: "api.newrelic.com",
  path: "/graphql",
  headers: {
    "Content-Type": "application/json",
    "Api-Key": apiKey
  }
}, DocsAgentQuery, function(error, DocsAgentData) {
  if (error) {
    console.error("Error fetching agent versions:", error);
    return;
  }

  // Extract the most recent agent version
  var DocsAgentVersions = DocsAgentData.data.docs.agentReleases;
  var mostRecentDocsAgentVersion = DocsAgentVersions.reduce(function(prev, current) {
    return (new Date(prev.date) > new Date(current.date)) ? prev : current;
  });

  console.log("Most recent agent version:", mostRecentDocsAgentVersion.version);

  // Make the NerdGraph API request to get the summary list of unique APM agent versions using NRQL
  makeNerdGraphRequest({ // APM Agent
    method: "POST",
    hostname: "api.newrelic.com",
    path: "/graphql",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey
    }
  }, apmAgentQuery, function(error, apmAgentData) {
    if (error) {
      console.error("Error fetching APM agent versions:", error);
      return;
    }

    // Extract the count of unique agents that existing in NR Account
    var results = apmAgentData.data.actor.nrql.results;
    if (!results || results.length === 0) {
      console.error("No results found for APM agent versions.");
      return;
    }

    // Extract the total count unique agents that existing in NR Account
    var uniqueApmAppCount = Object.values(results).reduce(function(count, agentCount) {
      return count + agentCount["uniqueCount.apmAppId"];
    }, 0);

    // Extract each APM agent version
    var apmAgents = Object.keys(results).filter(key => key !== 'UNKNOWN').map(key => key.toString());

    // Count out-of-date APM agents as compared with the latest Release called earlier from Docs in graphQL
    var countOfOutdatedAgents = apmAgents.reduce(function(count, agentVersion) {
      if (agentVersion.localeCompare(mostRecentDocsAgentVersion.version) < 0) {
        return count + 1;
      }
      return count;
    }, 0);

    console.log("Unique APM agent count for", agentType, "language:", uniqueApmAppCount);
    console.log("Out of date APM agents detected for", agentType, "language:", countOfOutdatedAgents);

    // Set synthetic monitoring custom attributes
    setSyntheticCustomAttributes(agentType, countOfOutdatedAgents, currentDate);
  });
});
