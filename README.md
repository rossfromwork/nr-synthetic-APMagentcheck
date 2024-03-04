# nr-synthetic-APMagentcheck
A ridiculous New Relic Synthetic API Check script that will check all your running APM agents against the latest versions and post a Synthetic Custom Attribute with a count of agents that are out of date for each APM Agent type. 

# Key things to know: 

* Uses New Relic Secure Credentials for your Account ID and API Key (API key used to make GraphQL API calls)
  * MYNR_API_KEY - Your NR API Key used for querying NerdGraph API
  * MYACCOUNT_ID - Your NR Account ID. Required for GraphQL Queries. 
* Is intended to be deployed as a Scripted API check.
* If you want to only check of a specific agent type (like NODEJS only), then you can either use the single agent script or update the AgentType var array. 
* Tested only with Scripted API NodeJS 16.10.
* Untested on large deployments of APM agents
* This purely checks based on version and does not take into account runtime support.
* It's not really necassary to run your Scripted Browser check frequently. Keep in mind that the slowest frequency a Scripted Browser check can run is 1 day.
  * Alert condition time window will have to be longer (1hour for example) and threshold period will also have to be similar for this to trigger your condition.

# NRQL to check the custom attributes are being written: 

`FROM SyntheticCheck SELECT custom.AgentType,custom.CountOfOutdatedAgents,custom.CheckDate WHERE monitorId = '<insertmonitoridhere>' SINCE 1 day ago`

# NRQL needed to setup an Threshold based Alert Condition
As we are now checking for all different APM agent types in the one script, you have two options for your Alert Condition NRQL. 

1. Have a single Alert Condition per APM Agent Language Type 

`FROM SyntheticCheck SELECT latest(custom.CountOfOutdatedAgents) WHERE monitorId = '<insertmonitoridhere>' AND custom.AgentType = '<APMLanguage>'`

2. Have a single Alert Condition that triggers if any APM Agent is detected as being out of date

`FROM SyntheticCheck SELECT latest(custom.CountOfOutdatedAgents) WHERE monitorId = '<insertmonitoridhere>' AND custom.AgentType = 'NODEJS' OR custom.AgentType = 'PHP' OR  custom.AgentType = 'JAVA' OR custom.AgentType = 'PYTHON' OR custom.AgentType = 'GO' OR custom.AgentType = 'RUBY' OR custom.AgentType = 'DOTNET'`

# Alert Condition FYI 
* You can then set Threshold to be whatever you want, obviously anything more than 0. It really depends on how many APM Agents you already have.
* For the Alert Condition - Signal Behaviour settings, I set the following,
  * Window duration: 6 hours
  * Sliding window aggregration: Enabled
  * Slide by internal: 15 mins
  * Streaming method: Event timer
* For the Alert Condition - Gaps, evaluation and loss of signal settings, I set the following,
  * Fill data gaps with: Last know value
* For the Alert Conditions - Thresholds, I set the following,
  * Critical (or Warning): Query result is ABOVE or Equal 1 at least once in 24 hours.
  * I did this because the check only runs 1 every 24 hours.  

# Future Things
- Support taking runtime supported versions into the logic of whether an agent is considered out of date or not.
- Alerting NRQL to compare as a % of overall APM agents deployed and alert on that. Rather than a specific agent count.
- Current advised Alert thresholds and data agg windows aren't necassarily accurate. Need more testing to clarify.
- Infra version at some point
