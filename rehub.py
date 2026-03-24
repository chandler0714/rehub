#!/usr/bin/env python3
"""
Rehub Skill - AI Agent for daily ReplyHubs visits
"""

import os
import json
import time
import requests
from datetime import datetime, timedelta
from croniter import croniter

class RehubSkill:
    def __init__(self):
        self.api_key = os.environ.get("REPLYHUBS_API_KEY", "")
        self.custom_question = os.environ.get("CUSTOM_QUESTION", "")
        self.visit_time = os.environ.get("VISIT_TIME", "09:00")
        self.action_mode = os.environ.get("ACTION_MODE", "manual")
        self.is_running = False
        self.last_visit_date = None
        self.current_question = None
        
    def configure(self, api_key: str, custom_question: str = "", visit_time: str = "09:00"):
        """配置 API Key 和访问计划"""
        self.api_key = api_key
        self.custom_question = custom_question
        self.visit_time = visit_time
        return "配置成功！请告诉我您希望每日访问的时间（格式：HH:MM），或者回复'手动'选择手动触发模式。"
    
    def set_time(self, visit_time: str) -> str:
        """设置每日访问时间"""
        try:
            hour, minute = map(int, visit_time.split(":"))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                self.visit_time = visit_time
                self.action_mode = "scheduled"
                return f"已设置每日 {visit_time} 访问。定时任务已启动。"
            return "时间格式错误，请使用 HH:MM 格式。"
        except:
            return "时间格式错误，请使用 HH:MM 格式，例如 09:00"
    
    def set_question(self, question: str) -> str:
        """设置自定义问题"""
        self.custom_question = question
        self.current_question = question
        return f"已设置自定义问题：{question}"
    
    def set_manual_mode(self) -> str:
        """切换到手动模式"""
        self.action_mode = "manual"
        self.is_running = False
        return "已切换到手动模式。回复'访问'立即触发，回复'退出'停止。"
    
    def visit(self) -> str:
        """执行访问操作"""
        if not self.api_key:
            return "错误：未配置 API Key。请先配置 API Key。"
        
        try:
            # 调用 ReplyHubs API 记录活动
            response = requests.post(
                "https://www.replyhubs.com/api/activity",
                json={
                    "apiKey": self.api_key,
                    "tokenDetail": self.custom_question or "daily visit"
                },
                timeout=10
            )
            
            if response.status_code == 200:
                today = datetime.now().strftime("%Y-%m-%d")
                
                # 如果是当天首次访问，记录问题
                if self.last_visit_date != today:
                    self.last_visit_date = today
                    if self.custom_question:
                        self.current_question = self.custom_question
                
                return f"访问成功！今日问题：{self.current_question or '无'}"
            else:
                return f"访问失败：{response.text}"
        except Exception as e:
            return f"访问出错：{str(e)}"
    
    def stop(self) -> str:
        """停止定时任务"""
        self.is_running = False
        return "定时任务已停止。回复'访问'可立即触发。"
    
    def status(self) -> str:
        """查看当前状态"""
        return f"""当前配置：
- API Key: {'已配置' if self.api_key else '未配置'}
- 访问模式: {self.action_mode}
- 访问时间: {self.visit_time}
- 自定义问题: {self.custom_question or '无'}
- 运行状态: {'运行中' if self.is_running else '已停止'}"""
    
    def handle_message(self, message: str) -> str:
        """处理用户消息"""
        msg = message.lower().strip()
        
        if "配置" in message and "api" in message.lower():
            # 提取 API Key
            parts = message.split()
            for i, part in enumerate(parts):
                if "key" in part.lower() and i + 1 < len(parts):
                    return self.configure(parts[i + 1])
            
        if "设置时间" in message:
            time_part = message.replace("设置时间", "").strip()
            return self.set_time(time_part)
        
        if "设置问题" in message:
            question = message.replace("设置问题", "").strip()
            return self.set_question(question)
        
        if msg in ["访问", "触发", "visit"]:
            return self.visit()
        
        if msg in ["退出", "停止", "exit", "stop"]:
            return self.stop()
        
        if msg in ["状态", "status"]:
            return self.status()
        
        if msg in ["手动"]:
            return self.set_manual_mode()
        
        return "未知命令。可用命令：访问、退出、设置时间、设置问题、状态"


def main():
    skill = RehubSkill()
    
    # 模拟处理消息
    test_commands = [
        "配置 API Key abc123",
        "设置时间 09:00",
        "设置问题 今天天气怎么样",
        "访问",
        "状态"
    ]
    
    print("=== Rehub Skill 测试 ===")
    for cmd in test_commands:
        print(f"\n> {cmd}")
        print(skill.handle_message(cmd))


if __name__ == "__main__":
    main()