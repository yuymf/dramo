# 分镜脚本提取提示词（Map阶段）

请为以下剧本片段生成分镜脚本。

## 剧本片段

{chunk_text}

## 处理指南

1. **场景边界**：
   - 如果片段开头不是完整场景起点，从第一个可识别的场景开始
   - 如果片段结尾未完成场景，生成到片段结束即可
   - 标注场景标题时包含序号占位符（如："场景X"），后续会重新编号
   - 特别注意识别虚拟空间、游戏场景、UI界面等特殊场景类型

2. **镜头设计**：
   - 根据剧本内容合理拆分镜头，突出叙事节奏和情绪变化
   - 优先使用建立镜头（establishing shot）开始新场景
   - 对话场景使用"镜头-反打镜头"（shot-reverse shot）
   - 重要动作或情感时刻使用特写
   - 动作场景要分解动作步骤，每个关键动作一个镜头
   - 虚拟/特效场景要明确特效类型和视觉表现

3. **细节补充**：
   - scene_description：详细描述画面中可见的一切
     * 人物：动作、表情、服装、位置关系
     * 环境：场景布局、光影氛围、色调、装饰细节
     * 特殊元素：UI界面、特效、虚拟元素的具体表现
   - director_notes：说明导演意图和艺术追求
     * 情绪基调和氛围营造
     * 节奏把控和张力构建
     * 演员表演要点和细腻之处
     * 与整体叙事的关联
   - audio_description：完整的声音设计
     * 对白内容（包括语气、停顿、情绪）
     * 音效（环境音、动作音、特殊音效）
     * 音乐（风格、情绪、进入退出时机）

4. **输出格式**：
   - 严格按照JSON数组格式输出
   - 不要添加markdown代码块标记
   - 确保所有字段都已填写
   - 每个字段的描述要具体、详细、可执行

## 示例输出

```json
[
  {
    "title": "办公室-白天",
    "summary": "主角李明在办公室接到一通改变命运的电话，神情从轻松转为凝重。",
    "shots": [
      {
        "shot_number": "001",
        "shot_size": "远景",
        "duration_seconds": 4,
        "scene_description": "现代化的开放式办公室，阳光透过落地窗洒进室内，李明坐在工位上专注地处理文件。",
        "director_notes": "营造平静的日常氛围，为即将到来的转折做铺垫。",
        "audio_description": "轻柔的环境音，键盘敲击声，远处同事的低声交谈。",
        "camera_angle": "平视",
        "camera_movement": "固定",
        "focal_length": "35mm",
        "characters": ["李明"],
        "locations": ["办公室"],
        "dialogues": [],
        "prompts": {
          "textToImage": "写实风格，现代化开放式办公室，远景，平视，李明坐在工位上专注处理文件，阳光透过落地窗洒进室内。",
          "textToVideo": "镜头从办公室入口缓缓推进，展示开放式布局，阳光透过落地窗洒进室内。李明坐在工位上，专注地在键盘上敲击，处理文件。"
        }
      },
      {
        "shot_number": "002",
        "shot_size": "中景",
        "duration_seconds": 3,
        "scene_description": "李明的手机突然震动，他拿起手机看到陌生号码，犹豫片刻后接听。",
        "director_notes": "通过犹豫动作暗示来电的不寻常。",
        "audio_description": "手机震动声，李明接听：'喂？'",
        "camera_angle": "平视",
        "camera_movement": "固定",
        "focal_length": "50mm",
        "characters": ["李明"],
        "locations": ["办公室"],
        "dialogues": [
          {
            "speaker": "李明",
            "text": "喂？",
            "type": "dialogue"
          }
        ],
        "prompts": {
          "textToImage": "写实风格，办公室，中景，平视，李明拿起震动的手机，看到陌生号码，犹豫片刻后接听。",
          "textToVideo": "李明桌上的手机突然震动，他停下手中工作，拿起手机，屏幕显示陌生号码。他眉头微皱，犹豫片刻后滑动接听。"
        }
      },
      {
        "shot_number": "003",
        "shot_size": "特写",
        "duration_seconds": 2,
        "scene_description": "李明的面部表情从轻松逐渐转为严肃，眉头紧锁。",
        "director_notes": "捕捉情绪转变的关键时刻，演员需要细腻的面部表演。",
        "audio_description": "电话中传来低沉的男声（具体内容根据剧本）。",
        "camera_angle": "平视",
        "camera_movement": "缓慢推进",
        "focal_length": "85mm",
        "characters": ["李明"],
        "locations": ["办公室"],
        "dialogues": [],
        "prompts": {
          "textToImage": "写实风格，办公室，特写，平视，李明的面部表情从轻松逐渐转为严肃，眉头紧锁。",
          "textToVideo": "镜头缓慢推进李明的面部，捕捉他听电话时的微表情变化：最初轻松的神态逐渐消失，眉头慢慢皱起，表情转为严肃凝重。"
        }
      }
    ]
  }
]
```

现在请处理上述剧本片段。

⚠️ JSON 安全：文本值中的所有引号（""''）必须转换为「」，绝不在 JSON 字符串值内使用原始 ASCII 双引号。
