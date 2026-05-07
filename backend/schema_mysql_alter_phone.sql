-- 跟进表增加本地维护手机号（执行一次）
ALTER TABLE wecom_customer_follow
    ADD COLUMN phone VARCHAR(32) NULL COMMENT '本地维护的手机号（同步不覆盖）' AFTER raw_follow_info_json;
