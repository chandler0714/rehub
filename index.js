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
const crypto = require('crypto');

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

// 生成回答 - 调用 AI API
async function generateAnswerWithAI(questionContent) {
  if (!config.apiKey) {
    return { error: 'API Key not configured.' };
  }

  try {
    // 调用站点的 /api/activity 接口进行对话（支持多轮对话）
    const response = await axios.post(`${BASE_URL}/api/activity`, {
      apiKey: config.apiKey,
      message: questionContent,
    }, {
      timeout: 30000 // AI 生成需要更长时间
    });

    if (response.data.success) {
      return {
        success: true,
        answer: response.data.response,
        tokenDetail: response.data.tokenDetail,
        startQuestion: response.data.startQuestion,
        remainingTurns: response.data.remainingTurns
      };
    } else {
      return { error: response.data.error || 'AI 生成失败' };
    }
  } catch (error) {
    return { error: `AI API 调用失败: ${error.message}` };
  }
}

// 生成 Token 明细（JWT 格式：header.payload.signature）
// 注意：实际使用时 token 值应由外部 AI API 返回真实消耗
function generateTokenDetail(inputText, outputText) {
  // 生成模拟的 token 值（实际应由 AI API 返回）
  const inputTokens = Math.ceil(inputText.length / 4);
  const outputTokens = Math.ceil(outputText.length / 4);
  const totalTokens = inputTokens + outputTokens;
  
  // 构建类似 JWT 格式的 token 明细
  const header = { alg: "模拟", typ: "TOKEN" };
  const payload = { 
    input: inputTokens,      // 输入 token 数量
    output: outputTokens,    // 输出 token 数量
    total: totalTokens,      // 总 token 数量
    timestamp: Date.now()   // 时间戳
  };
  // 简单的签名（模拟）
  const signature = crypto.createHash('sha256')
    .update(`${inputTokens}.${outputTokens}.${totalTokens}`)
    .digest('hex')
    .substring(0, 16);
  
  // 返回 JWT 格式字符串
  return `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${signature}`;
}

// 回答问题并记录 token
async function answerQuestion(questionId, questionContent, tokenDetail, answer) {
  if (!config.apiKey) {
    return { error: 'API Key not configured. Run: npx rehub-skill config <API_KEY>' };
  }

  try {
    // 调用 /api/question 提交回答并记录 token（answer 已经在 generateAnswerWithAI 中生成）
    const response = await axios.post(`${BASE_URL}/api/question`, {
      apiKey: config.apiKey,
      questionId: questionId,
      answer: answer,
      tokenDetail: tokenDetail // 直接使用传入的 token 明文
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

  // 2. 调用在线 AI 生成回答
  const aiResult = await generateAnswerWithAI(question.content);
  if (aiResult.error) {
    return aiResult.error;
  }
  const answer = aiResult.answer;
  const tokenDetail = aiResult.tokenDetail;
  config.lastAnswer = answer;

  // 3. 调用 /api/question 提交回答并记录 token
  const answerResult = await answerQuestion(question.id, question.content, tokenDetail, answer);
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
        // 调用 AI 生成回答
        const aiResult = await generateAnswerWithAI(config.currentQuestion.content);
        if (aiResult.error) {
          log(aiResult.error, 'red');
        } else {
          const ans = await answerQuestion(
            config.currentQuestion.id, 
            config.currentQuestion.content,
            aiResult.tokenDetail,
            aiResult.answer
          );
          if (ans.success) {
            log(`Answer: ${ans.answer}`, 'green');
          } else {
            log(ans.error, 'red');
          }
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