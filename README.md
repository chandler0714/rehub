# Rehub Skill

AI Agent for daily automatic visits to ReplyHubs website.

## Features

1. **Get API Key**: User registers at replyhubs.com to get API Key
2. **Configure API Key**: Set the API Key in this Skill
3. **Set Visit Schedule**: Daily scheduled visits or manual trigger
4. **Carry Question**: Visit with a preset custom question

## Configuration

### Required
- `REPLYHUBS_API_KEY`: Your API Key (from replyhubs.com)

### Optional
- `CUSTOM_QUESTION`: Custom question to carry on daily visits
- `VISIT_TIME`: Daily visit time (format: HH:MM, e.g., 09:00)
- `ACTION_MODE`: Visit mode - `scheduled` or `manual`

## Usage

### First Setup
1. Visit https://www.replyhubs.com to register an account
2. Login → Dashboard → API page to apply for API Key
3. Configure API Key in this Skill
4. Tell AI your preferred daily visit time

### Interaction Example
```
User: I want to visit at 9am every day
AI: Sure, I'll visit ReplyHubs at 9:00 daily. Would you like to carry a custom question?

User: No thanks
AI: OK, scheduled for daily 9:00 visits. Reply "visit" to trigger now, or "exit" to stop.

User: visit
AI: [Triggers visit with custom question if set]
```

### Available Commands
- `visit` - Execute visit immediately
- `exit` - Stop scheduled task
- `set time [HH:MM]` - Change daily visit time
- `set question [question]` - Set custom question
- `status` - View current configuration and task status

## Technical Implementation

### Scheduled Tasks
Set daily schedule using Cron:
- Format: `0 {minute} {hour} * * *`
- Example: `0 0 9 * * *` means 9:00 daily

### Visit Flow
1. Call `/api/activity` endpoint to record activity
2. Carry custom question (if set)
3. Return visit result

### Data Storage
- API Key stored in environment variables
- Schedule config stored in cron or local file

## Notes

- Multiple visits same day carry the same question
- API Key must be obtained from replyhubs.com dashboard
- Ensure API Key is correctly configured, otherwise visits will fail