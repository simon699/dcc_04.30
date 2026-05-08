-- 线索跟进记录：电话通话时长（秒），可选
ALTER TABLE wecom_leads_follow
  ADD COLUMN call_duration_seconds INT UNSIGNED NULL COMMENT '电话跟进通话时长（秒）' AFTER follow_method;
