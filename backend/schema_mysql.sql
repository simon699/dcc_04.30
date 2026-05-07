-- 企业微信「客户联系」同步表（utf8mb4）
-- 文档：92571 跟进成员列表；92113 客户 external_userid；批量详情 batch/get_by_user

CREATE TABLE IF NOT EXISTS wecom_follow_user (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(64) NOT NULL COMMENT '企业成员 userid',
    synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_userid (userid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='配置了客户联系功能的成员';

CREATE TABLE IF NOT EXISTS wecom_external_customer (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    external_userid VARCHAR(128) NOT NULL COMMENT '外部联系人 userid',
    name VARCHAR(255) NULL,
    position VARCHAR(255) NULL,
    avatar VARCHAR(1024) NULL,
    corp_name VARCHAR(255) NULL,
    corp_full_name VARCHAR(512) NULL,
    type SMALLINT NULL COMMENT '1微信用户 2企业微信用户',
    gender SMALLINT NULL,
    unionid VARCHAR(128) NULL,
    external_profile_json JSON NULL COMMENT 'external_profile 原始结构',
    raw_external_contact_json JSON NULL COMMENT 'external_contact 完整 JSON',
    synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_external_userid (external_userid),
    KEY idx_synced (synced_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='外部联系人主体';

CREATE TABLE IF NOT EXISTS wecom_customer_follow (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    follow_userid VARCHAR(64) NOT NULL COMMENT '跟进人（企业成员 userid）',
    external_userid VARCHAR(128) NOT NULL COMMENT '外部联系人 userid',
    remark VARCHAR(512) NULL,
    remark_corp_name VARCHAR(255) NULL COMMENT '92114 remark_corp_name',
    description TEXT NULL,
    createtime BIGINT NULL COMMENT '添加客户时间 Unix 秒',
    tag_id_json JSON NULL COMMENT '企业标签 id 列表（兼容批量接口 tag_id）',
    tags_json JSON NULL COMMENT '92114 follow_user.tags 完整数组',
    remark_mobiles_json JSON NULL,
    state VARCHAR(255) NULL,
    add_way INT NULL,
    wechat_channels_json JSON NULL COMMENT '92114 wechat_channels',
    oper_userid VARCHAR(128) NULL,
    raw_follow_info_json JSON NULL,
    phone VARCHAR(32) NULL COMMENT '本地维护的手机号（同步不覆盖）',
    synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_follow_external (follow_userid, external_userid),
    KEY idx_external (external_userid),
    KEY idx_follow_user (follow_userid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='成员对客户的跟进信息';
