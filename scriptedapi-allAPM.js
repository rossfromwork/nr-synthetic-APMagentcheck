// Scripted API script that checks running agent versions against the latest release for all supported APM language agents
// Import the https module
var https = require("https");

// New Relic API key (replace with your actual API key)
var apiKey = $secure.MYNR_API_KEY;

// New Relic account ID (replace with your actual account ID)
var accountId = $secure.MYACCOUNT_ID;

// Define agent types to check
var agentTypes = ["NODEJS", "DOTNET", "PHP", "GO", "PYTHON", "JAVA", "RUBY"];

// Define variables to hold the count of outdated agents and the date when the check was performed
var currentDate = new Date().toISOString(); // Get the current date in ISO format

// Construct the GraphQL query for the NerdGraph API request to get the list of agent versions
function constructAgentQuery(agentType) {
  return `
    query {
      docs {
        agentReleases(agentName: ${agentType}) {
          date
          version
        }
      }
    }
  `;
}

// Construct the GraphQL query for the NerdGraph API request to get the summary list of unique APM agent versions using NRQL
function constructApmQuery(agentType) {
  return `
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
}

// Function to make the NerdGraph API request
function makeNerdGraphRequest(options, query, agentType, callback) {
  var req = https.request(options, function(res) {
    var responseBody = "";

    res.on("data", function(chunk) {
      responseBody += chunk;
    });

    res.on("end", function() {
      try {
        var jsonData = JSON.parse(responseBody);
        callback(null, jsonData, agentType);
      } catch (error) {
        callback(error, null, agentType);
      }
    });
  });

  req.on("error", function(error) {
    callback(error, null, agentType);
  });

  req.write(JSON.stringify({ query: query }));
  req.end();
}

// Function to process agent data
function processAgentData(error, agentData, agentType) {
  if (error) {
    console.error(`Error fetching ${agentType} agent versions:`, error);
    return;
  }

  // Check if agent releases were returned
  var agentVersions = agentData.data.docs.agentReleases;
  if (!agentVersions || agentVersions.length === 0) {
    console.log(`No ${agentType} agent releases found.`);
    return;
  }

  // Extract the most recent agent version
  var mostRecentAgentVersion = agentVersions.reduce(function(prev, current) {
    return (new Date(prev.date) > new Date(current.date)) ? prev : current;
  });

  console.log(`Most recent ${agentType} agent version:`, mostRecentAgentVersion.version);

  // Make the NerdGraph API request to get the summary list of unique APM agent versions using NRQL
  var apmQuery = constructApmQuery(agentType);
  var options = constructOptions();

  makeNerdGraphRequest(options, apmQuery, agentType, function(error, apmData, type) {
    processApmData(error, apmData, mostRecentAgentVersion, type);
  });
}

// Function to process APM agent data
function processApmData(error, apmData, mostRecentAgentVersion, agentType) {
  if (error) {
    console.error(`Error fetching APM agent versions for ${agentType}:`, error);
    return;
  }

  // Extract APM agent version data
  var results = apmData.data.actor.nrql.results;
  if (!results || results.length === 0) {
    console.error(`No APM agent versions found for ${agentType}.`);
    return;
  }

  // Extract the count of unique APM app IDs
  var uniqueApmAppCount = Object.values(results).reduce(function(count, agentCount) {
    return count + agentCount["uniqueCount.apmAppId"];
  }, 0);

  // Extract each APM agent version
  var apmAgents = Object.keys(results).filter(key => key !== 'UNKNOWN').map(key => key.toString());

  // Count out-of-date APM agents as compared with the most recent agent version
  var countOfOutdatedAgents = apmAgents.reduce(function(count, agentVersion) {
    if (agentVersion.localeCompare(mostRecentAgentVersion.version) < 0) {
      return count + 1;
    }
    return count;
  }, 0);

  console.log(`Unique APM agent count for ${agentType} language:`, uniqueApmAppCount);
  console.log(`Out of date APM agents detected for ${agentType} language:`, countOfOutdatedAgents);

  // Set synthetic monitoring custom attributes if count of outdated agents is greater than 0
  if (countOfOutdatedAgents > 0) {
    setSyntheticCustomAttributes(agentType, countOfOutdatedAgents, currentDate);
  }
}

// Construct options for the NerdGraph API request
function constructOptions() {
  return {
    method: "POST",
    hostname: "api.newrelic.com",
    path: "/graphql",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey
    }
  };
}

// Make NerdGraph API requests for each agent type
agentTypes.forEach(function(agentType) {
  var agentQuery = constructAgentQuery(agentType);
  var options = constructOptions();

  makeNerdGraphRequest(options, agentQuery, agentType, function(error, agentData, type) {
    processAgentData(error, agentData, type);
  });
});

// Function to set synthetic monitoring custom attributes
function setSyntheticCustomAttributes(agentType, countOfOutdatedAgents, checkDate) {
  try {
    $util.insights.set("AgentType", agentType);
    $util.insights.set("CountOfOutdatedAgents", countOfOutdatedAgents);
    $util.insights.set("CheckDate", checkDate);
    console.log("Custom Synthetic Attributes added to NRQL");
  } catch (error) {
    console.error("Error adding custom synthetic attributes to NRQL:", error);
  }
}
