"use client";

import { useEffect } from "react";

let vconsoleInitScheduled = false;

function shouldEnableVConsole(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const flag = process.env.NEXT_PUBLIC_VCONSOLE;
  return flag === "1" || flag === "true";
}

/**
 * 移动端 / 企业微信内调试：展示日志、Network、Storage 等。
 * - 开发模式 (next dev) 默认开启
 * - 生产构建需设置 NEXT_PUBLIC_VCONSOLE=1 并重新 build
 */
export function VConsoleLoader() {
  useEffect(() => {
    if (!shouldEnableVConsole() || vconsoleInitScheduled) return;
    vconsoleInitScheduled = true;

    void import("vconsole").then(({ default: VConsole }) => {
      new VConsole();
    });
  }, []);

  return null;
}
