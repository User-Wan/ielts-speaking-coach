# 03｜数据模型草案

## users

- `id`
- `email` / `phone`
- `display_name`
- `created_at`
- `updated_at`

## courses

- `id`
- `title`
- `part`
- `question`
- `training_goal`
- `estimated_minutes`
- `source`
- `created_at`

## user_courses

- `id`
- `user_id`
- `course_id`
- `status`
- `latest_session_id`
- `created_at`
- `updated_at`

## training_sessions

- `id`
- `user_id`
- `course_id`
- `status`
- `current_step_key`
- `progress_data`：JSON，可扩展
- `started_at`
- `paused_at`
- `completed_at`
- `updated_at`

## conversation_turns

- `id`
- `session_id`
- `role`：`user` / `coach` / `system`
- `input_type`：`text` / `audio`
- `text`
- `audio_object_key`
- `step_key`
- `metadata`：JSON，可扩展
- `created_at`

## ai_feedback

- `id`
- `session_id`
- `turn_id`
- `result`
- `next_goal`
- `feedback_data`：JSON，可扩展
- `created_at`

## credit_ledger（第二阶段启用）

- `id`
- `user_id`
- `session_id`
- `change_amount`
- `reason`
- `created_at`

第一阶段不要把课时余额直接作为用户表中的可随意修改字段；正式启用时使用流水计算和审计。

