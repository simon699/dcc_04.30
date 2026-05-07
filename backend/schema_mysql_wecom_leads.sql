-- 线索主表与跟进记录（utf8mb4）
-- 可与企微 external_userid 关联；归属人为企业成员 userid

CREATE TABLE IF NOT EXISTS wecom_leads (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '线索ID',
    phone VARCHAR(32) NOT NULL COMMENT '手机号',
    customer_name VARCHAR(255) NOT NULL DEFAULT '' COMMENT '客户姓名',
    external_userid VARCHAR(128) NULL COMMENT '外部联系人 userid',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    intent_model VARCHAR(255) NULL COMMENT '意向车型',
    customer_level VARCHAR(64) NULL COMMENT '客户等级',
    owner_userid VARCHAR(64) NOT NULL COMMENT '归属人（成员 userid）',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_phone (phone),
    KEY idx_external_userid (external_userid),
    KEY idx_owner (owner_userid),
    KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='线索';

CREATE TABLE IF NOT EXISTS wecom_leads_follow (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    lead_id BIGINT UNSIGNED NOT NULL COMMENT '线索ID',
    follow_at DATETIME(3) NOT NULL COMMENT '跟进时间',
    remark TEXT NULL COMMENT '备注',
    next_follow_at DATETIME(3) NULL COMMENT '下次跟进时间',
    follow_method VARCHAR(64) NULL COMMENT '跟进方式：电话/企微/到店等',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_lead (lead_id),
    KEY idx_follow_at (follow_at),
    CONSTRAINT fk_wecom_leads_follow_lead
        FOREIGN KEY (lead_id) REFERENCES wecom_leads (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='线索跟进记录';
