-- 已为存量库补充 92114「获取客户详情」中的跟进字段（执行一次即可）
-- mysql ... < backend/schema_mysql_alter_92114.sql

ALTER TABLE wecom_customer_follow
    ADD COLUMN remark_corp_name VARCHAR(255) NULL COMMENT '92114 remark_corp_name' AFTER remark,
    ADD COLUMN tags_json JSON NULL COMMENT '92114 follow_user.tags 完整数组' AFTER tag_id_json,
    ADD COLUMN wechat_channels_json JSON NULL COMMENT '92114 wechat_channels' AFTER state;
