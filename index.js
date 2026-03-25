#!/usr/bin/env node

/**
 * Rehub Skill - AI Agent for daily automatic visits to ReplyHubs website
 * 
 * Features:
 * - 查询当日话题
 * - 自动回答问题
 * - 在回答结尾增加相关问题
 * - 调用 /api/activity 记录 token
 * 
 * Usage:
 *   npx rehub-skill visit        - Execute visit and answer question
 *   npx rehub-skill question     - Get today's question
 *   npx rehub-skill answer      - Answer today's question
 *   npx rehub-skill exit         - Stop scheduled task
 *   npx rehub-skill config       - Configure API Key
 *   npx rehub-skill status      - View current configuration
 *   npx rehub-skill set-time    - Set daily visit time
 */

const axios = require('axios');

// Configuration
const config = {
  apiKey: process.env.REPLYHUBS_API_KEY || '',
  visitTime: process.env.VISIT_TIME || '09:00',
  actionMode: process.env.ACTION_MODE || 'manual',
  isRunning: false,
  lastVisitDate: null,
  currentQuestion: null,
  lastAnswer: null
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

function configure(apiKey) {
  config.apiKey = apiKey;
  return 'API Key configured!';
}

// 获取今日话题
async function getTodayQuestion() {
  if (!config.apiKey) {
    return { error: 'API Key not configured. Run: npx rehub-skill config <API_KEY>' };
  }

  try {
    const response = await axios.get(`${BASE_URL}/api/question`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      },
      timeout: 10000
    });

    if (response.data.success && response.data.question) {
      return {
        success: true,
        question: response.data.question,
        allQuestions: response.data.allQuestions
      };
    } else {
      return { error: 'No questions available today' };
    }
  } catch (error) {
    return { error: `Failed to fetch question: ${error.message}` };
  }
}

// 生成回答（模拟 AI 回答，实际应由外部 AI 生成）
function generateAnswer(questionContent) {
  // 这里可以根据问题内容生成回答
  // 实际使用时应该调用外部 AI API
  const answers = [
    `这是一个有趣的话题。关于 "${questionContent}"，我认为需要从多个角度来分析。`,
    `针对这个问题，我可以分享一些见解。首先需要考虑相关的背景因素，然后才能给出合理的建议。`,
    `关于您提到的 "${questionContent}"，这是一个值得深思的问题。从客观角度来看，有几个关键点需要注意。`
  ];
  
  // 生成一个与上下文相关的问题
  const followUpQuestions = [
    '您对此有什么看法？',
    '您希望深入了解哪个方面？',
    '您是否有类似的经历可以分享？',
    '这个问题对您来说有什么特别的意义吗？',
    '您觉得还有其他需要考虑的因素吗？'
  ];
  
  const baseAnswer = answers[Math.floor(Math.random() * answers.length)];
  const followUp = followUpQuestions[Math.floor(Math.random() * followUpQuestions.length)];
  
  return `${baseAnswer}\n\n${followUp}`;
}

// 回答问题并记录 token
async function answerQuestion(questionId, questionContent, tokenDetail) {
  if (!config.apiKey) {
    return { error: 'API Key not configured. Run: npx rehub-skill config <API_KEY>' };
  }

  try {
    // 生成回答
    const answer = generateAnswer(questionContent);
    config.lastAnswer = answer;

    // 调用 /api/question 提交回答并记录 token
    const response = await axios.post(`${BASE_URL}/api/question`, {
      apiKey: config.apiKey,
      questionId: questionId,
      answer: answer,
      tokenDetail: tokenDetail || `input: ${questionContent.length * 2}, output: ${answer.length * 2}, total: ${(questionContent.length + answer.length) * 2}`
    }, {
      timeout: 10000
    });

    return {
      success: true,
      answer: answer,
      activity: response.data.activity
    };
  } catch (error) {
    return { error: `Failed to submit answer: ${error.message}` };
  }
}

// 记录 token 到 /api/activity
async function recordActivity(tokenDetail) {
  if (!config.apiKey) {
    return { error: 'API Key not configured. Run: npx rehub-skill config <API_KEY>' };
  }

  try {
    const response = await axios.post(`${BASE_URL}/api/activity`, {
      apiKey: config.apiKey,
      tokenDetail: tokenDetail || 'daily visit'
    }, { timeout: 10000 });

    if (response.status === 200 && response.data.success) {
      return { success: true, activity: response.data.activity };
    } else {
      return { error: 'Failed to record activity' };
    }
  } catch (error) {
    return { error: `Failed to record activity: ${error.message}` };
  }
}

// 执行完整访问流程
async function visit() {
  const today = new Date().toISOString().split('T')[0];
  
  // 每天只执行一次
  if (config.lastVisitDate === today) {
    return `Already visited today. Next visit: tomorrow`;
  }

  // 1. 获取今日话题
  const questionData = await getTodayQuestion();
  if (questionData.error) {
    return questionData.error;
  }

  const question = questionData.question;
  config.currentQuestion = question;

  // 2. 生成回答（这里模拟 AI 生成，实际应调用外部 AI）
  const answer = generateAnswer(question.content);
  config.lastAnswer = answer;

  // 3. 计算 token（简化计算）
  const inputTokens = question.content.length;
  const outputTokens = answer.length;
  const totalTokens = inputTokens + outputTokens;
  const tokenDetail = `input: ${inputTokens}, output: ${outputTokens}, total: ${totalTokens}`;

  // 4. 回答问题并记录 token
  const answerResult = await answerQuestion(question.id, question.content, tokenDetail);
  if (answerResult.error) {
    return answerResult.error;
  }

  // 5. 同时调用 /api/activity 确保记录
  await recordActivity(tokenDetail);

  config.lastVisitDate = today;

  return `Visit completed!
Question: ${question.content}
Answer: ${answer}
Token: ${tokenDetail}`;
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
- Running: ${config.isRunning ? 'yes' : 'no'}
- Last Visit: ${config.lastVisitDate || 'never'}
- Current Question: ${config.currentQuestion ? config.currentQuestion.content : 'none'}`;
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

// CLI Handler
async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'visit':
    case 'trigger':
      log(await visit(), 'green');
      break;
      
    case 'question':
      const q = await getTodayQuestion();
      if (q.error) {
        log(q.error, 'red');
      } else {
        log(`Today's Question #${q.question.order}: ${q.question.content}`, 'blue');
      }
      break;
      
    case 'answer':
      if (!config.currentQuestion) {
        log('No question loaded. Run "question" first.', 'yellow');
      } else {
        const ans = await answerQuestion(
          config.currentQuestion.id, 
          config.currentQuestion.content,
          'manual answer'
        );
        if (ans.success) {
          log(`Answer: ${ans.answer}`, 'green');
        } else {
          log(ans.error, 'red');
        }
      }
      break;
      
    case 'exit':
    case 'stop':
      log(stop(), 'yellow');
      break;
      
    case 'config':
      if (args[0]) {
        log(configure(args[0]), 'green');
      } else {
        log('Usage: npx rehub-skill config <API_KEY>', 'yellow');
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
      
    case 'help':
    default:
      log(`
Rehub Skill - AI Agent for daily visits to ReplyHubs

Usage:
  npx rehub-skill visit           Execute full visit (get question, answer, record token)
  npx rehub-skill question        Get today's question
  npx rehub-skill answer          Answer current question
  npx rehub-skill exit            Stop scheduled task
  npx rehub-skill config <KEY>    Configure API Key
  npx rehub-skill set-time HH:MM  Set daily visit time
  npx rehub-skill status          View configuration
  npx rehub-skill help            Show this help

Environment Variables:
  REPLYHUBS_API_KEY    Your API Key from replyhubs.com
  VISIT_TIME          Daily visit time (HH:MM)

Flow:
  1. Query today's question via /api/question
  2. Generate answer with a follow-up question at the end
  3. Submit answer via /api/question
  4. Record token via /api/activity

Examples:
  npx rehub-skill config abc123
  npx rehub-skill visit
  npx rehub-skill question
      `, 'blue');
  }
}

main();