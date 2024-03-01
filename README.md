# nr-syntheticbrowser-APMagentcheck
A ridiculous New Relic Synethic browser script to check agent version and write a custom attribute which an Alert can be setup to monitor

# Key things to know: 

* Uses New Relic Secure Credentials for your Account ID and API Key (API key used to make GraphQL API calls)
  * MYNR_API_KEY - Your NR API Key used for querying NerdGraph API
  * MYACCOUNT_ID - Your NR Account ID. Required for GraphQL Queries. 
* You need to set the AgentType var for the APM agent language you wish to check.
* Recommend deploying a Scripted Browser check for each APM Agent language you are running.
* Larger APM deployments may hit issues as Scripted Browser scripts can only run for a maximum of 3 minutes (180 seconds).
* It's not really necassary to run your Scripted Browser check frequently. Keep in mind that the slowest frequency a Scripted Browser check can run is 1 day.
  * Alert condition time window will have to be longer (1hour for example) and threshold period will also have to be similar for this to trigger your condition.

# NRQL to check the custom attirbutes are being written: 

`FROM SyntheticCheck SELECT custom.AgentType,custom.CountOfOutdatedAgents,custom.CheckDate WHERE monitorId = '<insertmonitoridhere>' SINCE 1 day ago`

# NRQL needed to setup an Threshold based Alert Condition
For each Scripted Browser you deploy, suggest creating an Alert Condition but group the conditions under one policy to help manage the noise.

`FROM SyntheticCheck SELECT latest(custom.CountOfOutdatedAgents) WHERE monitorId = '<insertmonitoridhere>' AND custom.AgentType = '<APMLanguage>'`

You can then set Threshold to be whatever you want, obviously anything more than 0. It really depends on how many APM Agents you already have. 

# Things to improve
- Alerting NRQL to compare as a % of overall APM agents deployed and alert on that. Rather than a specific agent count.
- Current advised Alert thresholds and data agg windows aren't necassarily accurate. Need more testing to clarify. 
