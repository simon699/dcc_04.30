-- 任务主表与对象明细（utf8mb4）
-- 任务对象明细用于群发等「每人状态不同」的场景

CREATE TABLE IF NOT EXISTS wecom_task (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '任务ID',
    task_type VARCHAR(32) NOT NULL COMMENT 'mass_send群发任务 follow_up跟进任务',
    channel VARCHAR(16) NOT NULL COMMENT 'phone电话 wecom企微',
    name VARCHAR(512) NOT NULL COMMENT '任务名称',
    description TEXT NULL COMMENT '任务描述',
    mass_content TEXT NULL COMMENT '群发内容',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '任务创建时间',
    start_at DATETIME(3) NULL COMMENT '任务开始执行时间',
    creator_userid VARCHAR(64) NOT NULL DEFAULT 'ShiFengwei' COMMENT '创建人',
    status VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending in_progress done cancelled',
    deadline DATETIME(3) NULL COMMENT '截止时间',
    completed_at DATETIME(3) NULL COMMENT '任务完成时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_wecom_task_channel (channel),
    KEY idx_wecom_task_status (status),
    KEY idx_wecom_task_deadline (deadline),
    KEY idx_wecom_task_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='企微任务';

CREATE TABLE IF NOT EXISTS wecom_task_target (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    task_id BIGINT UNSIGNED NOT NULL COMMENT '任务ID',
    target_external_userid VARCHAR(128) NULL COMMENT '客户 external_userid，与手机至少其一',
    target_phone VARCHAR(32) NULL COMMENT '客户手机，与 external 至少其一',
    status VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending in_progress done failed',
    started_at DATETIME(3) NULL COMMENT '该对象开始处理时间',
    completed_at DATETIME(3) NULL COMMENT '该对象完成时间',
    remark TEXT NULL COMMENT '备注',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_task_target_task (task_id),
    CONSTRAINT fk_wecom_task_target_task
        FOREIGN KEY (task_id) REFERENCES wecom_task (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='任务对象明细';
