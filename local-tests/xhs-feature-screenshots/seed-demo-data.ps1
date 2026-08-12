$ErrorActionPreference = 'Stop'
$baseUrl = 'http://127.0.0.1:43129'

function Invoke-DemoApi {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][hashtable]$Body
  )
  $json = $Body | ConvertTo-Json -Depth 30
  Invoke-RestMethod -Method Post -Uri "$baseUrl$Path" -ContentType 'application/json; charset=utf-8' -Body $json
}

Invoke-DemoApi -Path '/api/profile' -Body @{ displayName = '演示用户' } | Out-Null
Invoke-DemoApi -Path '/api/plan' -Body @{ lengthDays = 14; weeklyTarget = 5; focus = 'balanced' } | Out-Null

$dashboard = Invoke-RestMethod -Uri "$baseUrl/api/dashboard"

$demoSessions = @(
  @{
    Prompt = 'What piece of technology do you use most often?'
    Part = 'Part 1'
    Answer = 'I use my laptop every day because it help me study English and finish my work. I also use it to practise speaking.'
    Summary = '回答切题，也给出了使用场景；下一步重点是修正主谓一致，并补充一个更具体的例子。'
    MustCorrect = @(@{ original = 'it help me'; improved = 'it helps me'; reason = '第三人称单数需要使用 helps。' })
    Natural = @(@{ original = 'finish my work'; improved = 'get my work done'; reason = '在口语里更自然。' })
    Habit = @(@{ original = 'I use... I also use...'; improved = '可以用 One reason is... 补充第二层信息'; reason = '减少相同句式连续开头。' })
    Logic = @(@{ original = '回答停留在用途罗列'; improved = '直接回答 → 原因 → 一个具体使用场景'; reason = '让 Part 1 回答更完整但不过度展开。' })
    Vocabulary = @(@{ original = 'help me study English'; improved = 'support my English learning'; reason = '更准确地描述长期学习用途。' })
    Revised = 'I use my laptop most often because it helps me study English and get my work done. For example, I use it to organise my notes and practise speaking online.'
    TargetId = 'demo-specific-example'
    Target = '回答观点后补充一个具体例子'
    TargetReason = '目前回答有观点和原因，但例子还不够具体。'
  },
  @{
    Prompt = 'What do you like about your neighbourhood?'
    Part = 'Part 1'
    Answer = 'I like my neighbourhood because it is very convenient. There is many shops and I can go everywhere very easy.'
    Summary = '回答有清楚的主观点；需要修正 there be 结构，并把 convenient 解释得更具体。'
    MustCorrect = @(@{ original = 'There is many shops'; improved = 'There are many shops'; reason = '复数名词 shops 应搭配 are。' })
    Natural = @(@{ original = 'go everywhere very easy'; improved = 'get around very easily'; reason = '更自然的地点与出行表达。' })
    Habit = @(@{ original = 'very convenient / very easy'; improved = 'well connected / within walking distance'; reason = '减少重复使用 very。' })
    Logic = @(@{ original = '只说明方便'; improved = '说明方便 → 举出附近设施 → 解释对日常生活的影响'; reason = '让理由有可感知的细节。' })
    Vocabulary = @(@{ original = 'very convenient'; improved = 'well connected'; reason = '适合描述社区交通和位置。' })
    Revised = 'What I like most is that my neighbourhood is well connected. There are many shops within walking distance, so it is easy to get around and deal with everyday errands.'
    TargetId = 'demo-specific-detail'
    Target = '用一个具体细节解释抽象评价'
    TargetReason = '把 convenient 变成可感知的生活场景。'
  },
  @{
    Prompt = 'Which practical skills should schools teach?'
    Part = 'Part 3'
    Answer = 'I think schools should teach communication skills because it useful for students. For example, they can talk with other people more confident.'
    Summary = '观点明确，并尝试使用例子；下一步需要修正句法，同时把例子解释到实际结果。'
    MustCorrect = @(@{ original = 'because it useful'; improved = 'because it is useful'; reason = '形容词 useful 前需要 be 动词。' })
    Natural = @(@{ original = 'talk with other people more confident'; improved = 'communicate with other people more confidently'; reason = '需要使用副词修饰 communicate。' })
    Habit = @(@{ original = 'I think... because... For example...'; improved = '先说明技能，再解释适用场景和结果'; reason = '避免只套用固定三句模板。' })
    Logic = @(@{ original = '例子停留在笼统结果'; improved = '观点 → 学校场景 → 具体行为 → 长期影响'; reason = 'Part 3 需要更完整的因果链。' })
    Vocabulary = @(@{ original = 'talk with other people'; improved = 'express ideas clearly and collaborate with others'; reason = '更准确地描述沟通能力。' })
    Revised = 'Schools should teach communication skills because students need to express ideas clearly and collaborate with others. For example, group projects can train them to explain their opinions, listen to different views and resolve disagreements. These skills are also useful later in university and at work.'
    TargetId = 'demo-cause-chain'
    Target = '把例子继续解释到实际结果'
    TargetReason = '已经会举例，下一步是补全例子为什么能支持观点。'
  }
)

foreach ($item in $demoSessions) {
  $question = $dashboard.questions | Where-Object { $_.prompt -eq $item.Prompt } | Select-Object -First 1
  if (-not $question) { throw "找不到演示题目：$($item.Prompt)" }

  $selection = Invoke-DemoApi -Path '/api/training-selection' -Body @{
    route = 'choose_question'
    part = $item.Part
    length = 'standard'
    questionId = $question.id
    selectedReference = $item.Prompt
    singleGoal = '完成自然、具体的回答'
  }

  $report = @{
    summary = $item.Summary
    focus_part = $item.Part
    must_correct = $item.MustCorrect
    natural_upgrades = $item.Natural
    repeated_habits = $item.Habit
    logic_feedback = $item.Logic
    vocabulary_upgrades = $item.Vocabulary
    answer_upgrades = @(@{
      question = $item.Prompt
      original_answer = $item.Answer
      revised_answer = $item.Revised
      changes = @('纠正关键语法', '保留原来的观点', '补充可验证的展开结构')
    })
    priority_target = @{
      id = $item.TargetId
      description = $item.Target
      reason = $item.TargetReason
      status = 'new'
      evidence = @($item.Answer)
    }
    next_target = $item.Target
  }

  Invoke-DemoApi -Path '/api/desktop/session-complete' -Body @{
    sessionId = $selection.session.id
    transcript = @(
      @{ role = 'assistant'; text = $item.Prompt; status = 'complete' },
      @{ role = 'user'; text = $item.Answer; status = 'complete' }
    )
    report = $report
    rawReport = '公开演示数据'
  } | Out-Null
}

Write-Output 'Demo data seeded.'
