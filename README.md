# Google Ads Scripts In Market Bid Modifer Script
Script for Google Ads applying bid modifers to in-market audiences based on ROAS, CPA or CPC performance at campaign and audience level.
Based on the Brainlabs script by Daniel Gilbert applying bid modifiers to in-market audiences based on CPA performance.

# How to install these script in Google Ads:

1. Select an active Google Ads account (one that uses in-market audiences)
2. Go to Tools > Bulk Actions > Scripts
3. Add a new script
4. Give it a name (e.g: "ROAS In Market Bid Modifer")
5. Copy the entire content of the ROAS, CPA or CPC JavaScript file hosted in this github repository and paste it in your newly created Google Ads Script (replacing the 3 lines of code already present by default)
6. Hit "save" and "preview" to verify the changes that it would apply to your bid modifiers.
7. Hit "Run" to apply changes to your Google Ads account

# How to use this script in Google Ads:

At the top of the script are 4 editable parameters: 

- DATE_RANGE: use this to select the date range that the script will use to pull its data
- MAX_BID_LIMIT: set a maximum bid modifier that the script won't exceed (prevents excessive spend)
- CAMPAIGN_NAME_DOES_NOT_CONTAIN: use this to exclude specific campaigns from being included in the script
- CAMPAIGN_NAME_CONTAINS: use this to only look at specific campaigns, as opposed to looking through the whole account

More information and notes can be found in the script comments.
