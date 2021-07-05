//CPA In-Market Bid Modifer Script
//Written by Kevin Germain for Zenith Global, based on the Brainlabs CPA bid modifer script written by Daniel Gilbert

// Use this to determine the relevant date range for your data.
// Possible options: TODAY, YESTERDAY, LAST_7_DAYS, THIS_WEEK_SUN_TODAY, LAST_WEEK,
// LAST_14_DAYS, LAST_30_DAYS, LAST_BUSINESS_WEEK, LAST_WEEK_SUN_SAT, THIS_MONTH, LAST_MONTH, ALL_TIME
var DATE_RANGE = 'LAST_30_DAYS';

//Limit the max bid modifer 
//0.1 = 10% of original bid
//1.0 = original bid
//2.0 = 200% = twice the original bid
var MAX_BID_LIMIT = 2.0;

// Use this if you want to exclude some campaigns. Case insensitive.
// For example ["Brand"] would ignore any campaigns with 'brand' in the name,
// while ["Brand","Competitor"] would ignore any campaigns with 'brand' or
// 'competitor' in the name.
// Leave as [] to not exclude any campaigns.
var CAMPAIGN_NAME_DOES_NOT_CONTAIN = [];

// Use this if you only want to look at some campaigns.  Case insensitive.
// For example ["Brand"] would only look at campaigns with 'brand' in the name,
// while ["Brand","Generic"] would only look at campaigns with 'brand' or 'generic'
// in the name.
// Leave as [] to include all campaigns.
var CAMPAIGN_NAME_CONTAINS = [];

//DO NOT CHANGE ANYTHING BELOW THIS LINE
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var AUDIENCE_MAPPING_CSV_DOWNLOAD_URL = 'https://developers.google.com/google-ads/api/data/tables/in-market-categories.tsv';

function main() {
  Logger.log('Getting audience mapping');
  var audienceMapping = getInMarketAudienceMapping(AUDIENCE_MAPPING_CSV_DOWNLOAD_URL);
  
  Logger.log('Getting campaign CPA');
  var campaignCPA = getCampaignCPA();
  
  Logger.log('Getting audiences CPA');
  var listOfAudiencesCPA = getAudienceCPA();
  
  Logger.log('Making operations');
  var operations = makeAllOperations(audienceMapping, campaignCPA, listOfAudiencesCPA);

  Logger.log('Applying bids');
  applyBids(operations, audienceMapping);
}

//RUNS 1
//Maps audiences to numeric codes, returns object with the following format "{audience ID = audience name, ...}"
function getInMarketAudienceMapping(downloadCsvUrl) {
  var csv = Utilities.parseCsv(UrlFetchApp.fetch(downloadCsvUrl).getContentText(),'\t');
  var headers = csv[0];
  var indexOfId = headers.indexOf('Criterion ID');
  var indexOfName = headers.indexOf('Category');

  if ((indexOfId === -1) || (indexOfName === -1)) {
    throw new Error('The audience CSV does not have the expected headers');
  }

  var mapping = {};
  for (var i = 1; i < csv.length; i++) {
    var row = csv[i];
    mapping[row[indexOfId]] = row[indexOfName];
  }
  return mapping;
}

//RUNS 2
//returns campaign level performance for Cost Per Conversion
function getCampaignCPA(){
  var campaignCPA = {};
  var query = "SELECT CampaignName, CostPerConversion FROM CAMPAIGN_PERFORMANCE_REPORT WHERE CostPerConversion > 0 DURING " + DATE_RANGE;
  var rows = AdsApp.report(query).rows();

  while (rows.hasNext()) {
    var row = rows.next();
    var costPerConversion = row.CostPerConversion;
    costPerConversion = parseFloat(costPerConversion.replace(",", ""));
    campaignCPA[row['CampaignName']] = costPerConversion;
  }
  return campaignCPA;
}

//RUNS 3
//returns audience level performance for Cost Per Conversion
function getAudienceCPA(){
  var listOfAudiencesCPA = [];
  var query = "SELECT Criteria, CostPerConversion, CampaignName FROM AUDIENCE_PERFORMANCE_REPORT WHERE CostPerConversion > 0 DURING " + DATE_RANGE;
  var rows = AdsApp.report(query).rows();

  while (rows.hasNext()) {
    var row = rows.next();
    var criteriaSplit = row['Criteria'].split("::"); //removes the prefix from the audience ID
    var uniqueID = row['CampaignName'] + criteriaSplit[1]; //creates a unique ID that can later be retrieved
    var costPerConversion = row.CostPerConversion;
    costPerConversion = parseFloat(costPerConversion.replace(",", ""));
    var audienceObject = {campaignName: row['CampaignName'], audienceID: criteriaSplit[1], CPA: costPerConversion, uniqueID: uniqueID}
    listOfAudiencesCPA.push(audienceObject);
  }
  return listOfAudiencesCPA;
}

//Filters campaigns based on names
function filterCampaignsBasedOnName(campaigns) {
  CAMPAIGN_NAME_DOES_NOT_CONTAIN.forEach(function(part) {
    campaigns = campaigns.withCondition("CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + part.replace(/"/g,'\\\"') + "'");
  });

  CAMPAIGN_NAME_CONTAINS.forEach(function(part) {
    campaigns = campaigns.withCondition("CampaignName CONTAINS_IGNORE_CASE '" + part.replace(/"/g,'\\\"') + "'");
  });

  return campaigns;
}

//RUNS 4
//Pulls and uses campaigns (not from the performance object higher up), returns a list of operation objects to apply with a separate function
function makeAllOperations(audienceMapping, campaignCPA, listOfAudiencesCPA) {
  var operations = [];
  var allCampaigns = filterCampaignsBasedOnName(AdWordsApp.campaigns());
  
  var filteredCampaigns = allCampaigns //filter campaigns based on criteria
    .forDateRange(DATE_RANGE)
    .withCondition('Impressions > 0')
    .get(); 

  while (filteredCampaigns.hasNext()) { //iterates over each campaign
    var campaign = filteredCampaigns.next();
    var operationsFromCampaign = makeOperationsFromEntity(campaign, campaignCPA[campaign.getName()], audienceMapping, "Campaign", listOfAudiencesCPA); //for each item in the campaign performance list, it takes the CPA
    operations = operations.concat(operationsFromCampaign); //adds each campaign operation to the list of operations to make
  }
  return operations;
}

//RUNS 4.1
//Provides an object with a CPA, Audiences used, Campaign Name and Type - RUNS ONCE PER CAMPAIGN, type is "Campaign"
function makeOperationsFromEntity(campaign, campaignCPA, audienceMapping, levelApplyingAt, listOfAudiencesCPA) {
  var entityAudiences = getAudiencesFromEntity(campaign, audienceMapping); //Get all audiences for each campaign
  return makeOperations(campaignCPA, entityAudiences, campaign.getName(), levelApplyingAt, listOfAudiencesCPA);
}


//RUNS 4.1.1
//Checks what audiences are used in campaign
function getAudiencesFromEntity(entity, audienceMapping) {
  var inMarketIds = Object.keys(audienceMapping); //takes the audience keys (IDs) defined within the first function

  var allAudiences = entity
    .targeting()
    .audiences()
    .forDateRange(DATE_RANGE)
    .withCondition('Impressions > 0')
    .get();

  var inMarketAudiences = [];
  while (allAudiences.hasNext()) {
    var audience = allAudiences.next();
    if (inMarketIds.indexOf(audience.getAudienceId()) > -1) { //Checks if the audience used is an in-market audience
      inMarketAudiences.push(audience);
    }
  }
  return inMarketAudiences;
}

//RUNS 4.1.2
//Returns a list of objects each containing an audience, a modifier, the campaign name and type (campaign)
function makeOperations(campaignCPA, audiences, entityName, entityType, listOfAudiencesCPA) {
  var operations = [];

  audiences.forEach(function (audience) {
    
    var audienceID = audience.getAudienceId();
    var audienceCampaign = audience.getCampaign();
    var campaignName = audienceCampaign.getName();
    var uniqueID = campaignName + audienceID;
    
    var arrayLength = listOfAudiencesCPA.length;
    for (var i = 0; i < arrayLength; i++) {
      if (listOfAudiencesCPA[i].uniqueID === uniqueID){
        var audienceCPA = listOfAudiencesCPA[i].CPA;
        var modifier = (campaignCPA / audienceCPA)
        if(modifier < 0.1) modifier = 0.1;
        if(modifier > MAX_BID_LIMIT) modifier = MAX_BID_LIMIT;

        var operation = {};
        operation.audience = audience;
        operation.modifier = modifier;
        operation.entityName = entityName;
        operation.entityType = entityType;

        operations.push(operation);
      }
    }
  });
  return operations;
}

//RUNS 5
function applyBids(operations, audienceMapping) {
  operations.forEach(function (operation) {
    Logger.log(" - Updating " + operation.entityType + ": '" + operation.entityName + "'; ");
    Logger.log("     - Audience: '" + audienceMapping[operation.audience.getAudienceId()] + "' ");
    Logger.log("     - New Modifier: " + operation.modifier);
    operation.audience.bidding().setBidModifier(operation.modifier);
  });
}