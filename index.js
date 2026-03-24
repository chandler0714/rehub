#!/usr/bin/env node

/**
 * Rehub Skill - AI Agent for daily automatic visits to ReplyHubs website
 * 
 * Usage:
 *   npx rehub-skill visit        - Execute visit immediately
 *   npx rehub-skill exit         - Stop scheduled task
 *   npx rehub-skill config       - Configure API Key
 *   npx rehub-skill status      - View current configuration
 *   npx rehub-skill set-time    - Set daily visit time
 *   npx rehub-skill set-question - Set custom question
 */

const axios = require('axios');

// Configuration
const config = {
  apiKey: process.env.REPLYHUBS_API_KEY || '',
  customQuestion: process.env.CUSTOM_QUESTION || '',
  visitTime: process.env.VISIT_TIME || '09:00',
  actionMode: process.env.ACTION_MODE || 'manual',
  isRunning: false,
  lastVisitDate: null,
  currentQuestion: null
};

const BASE_URL = 'https://www.replyhubs.com';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function configure(apiKey, options = {}) {
  config.apiKey = apiKey;
  if (options.question) config.customQuestion = options.question;
  if (options.time) config.visitTime = options.time;
  return 'Configuration saved!';
}

async function visit() {
  if (!config.apiKey) {
    return 'Error: API Key not configured. Run: npx rehub-skill config <API_KEY>';
  }

  try {
    const response = await axios.post(`${BASE_URL}/api/activity`, {
      apiKey: config.apiKey,
      tokenDetail: config.customQuestion || 'daily visit'
    }, { timeout: 10000 });

    if (response.status === 200) {
      const today = new Date().toISOString().split('T')[0];
      
      // Only set question on first visit of the day
      if (config.lastVisitDate !== today) {
        config.lastVisitDate = today;
        if (config.customQuestion) {
          config.currentQuestion = config.customQuestion;
        }
      }

      return `Visit successful! Question: ${config.currentQuestion || 'none'}`;
    }
  } catch (error) {
    return `Visit failed: ${error.message}`;
  }
}

function stop() {
  config.isRunning = false;
  return 'Scheduled task stopped.';
}

function status() {
  return `Current Configuration:
- API Key: ${config.apiKey ? 'configured' : 'not configured'}
- Visit Mode: ${config.actionMode}
- Visit Time: ${config.visitTime}
- Custom Question: ${config.customQuestion || 'none'}
- Running: ${config.isRunning ? 'yes' : 'no'}`;
}

function setTime(time) {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return 'Invalid time format. Use HH:MM (e.g., 09:00)';
  
  const hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  
  if (hour > 23 || minute > 59) return 'Invalid time value';
  
  config.visitTime = time;
  config.actionMode = 'scheduled';
  return `Visit time set to ${time}`;
}

function setQuestion(question) {
  config.customQuestion = question;
  config.currentQuestion = question;
  return `Custom question set: ${question}`;
}

// CLI Handler
async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'visit':
    case 'trigger':
      log(await visit(), 'green');
      break;
      
    case 'exit':
    case 'stop':
      log(stop(), 'yellow');
      break;
      
    case 'config':
      if (args[0]) {
        const options = {};
        if (args[1] === '--question') options.question = args[2];
        if (args[1] === '--time') options.time = args[2];
        log(configure(args[0], options), 'green');
      } else {
        log('Usage: npx rehub-skill config <API_KEY> [--question "question"] [--time HH:MM]', 'yellow');
      }
      break;
      
    case 'status':
      log(status(), 'blue');
      break;
      
    case 'set-time':
      if (args[0]) {
        log(setTime(args[0]), 'green');
      } else {
        log('Usage: npx rehub-skill set-time HH:MM', 'yellow');
      }
      break;
      
    case 'set-question':
      if (args.length > 0) {
        log(setQuestion(args.join(' ')), 'green');
      } else {
        log('Usage: npx rehub-skill set-question "your question"', 'yellow');
      }
      break;
      
    case 'help':
    default:
      log(`
Rehub Skill - AI Agent for daily visits to ReplyHubs

Usage:
  npx rehub-skill visit           Execute visit immediately
  npx rehub-skill exit            Stop scheduled task
  npx rehub-skill config <KEY>    Configure API Key
  npx rehub-skill set-time HH:MM  Set daily visit time
  npx rehub-skill set-question    Set custom question
  npx rehub-skill status          View configuration
  npx rehub-skill help            Show this help

Environment Variables:
  REPLYHUBS_API_KEY    Your API Key from replyhubs.com
  CUSTOM_QUESTION      Custom question for visits
  VISIT_TIME          Daily visit time (HH:MM)
  ACTION_MODE         'scheduled' or 'manual'

Examples:
  npx rehub-skill config abc123 --question "How are you?"
  npx rehub-skill set-time 09:00
  npx rehub-skill visit
      `, 'blue');
  }
}

main();