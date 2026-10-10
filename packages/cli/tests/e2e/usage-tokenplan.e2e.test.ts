import { describe, expect, test } from "vite-plus/test";
import { isBailianE2EEnabled, parseStdoutJson, runCli } from "./helpers.ts";
import { readConfigFile } from "bailian-cli-core";

function isConsoleE2EReady(): boolean {
  if (!isBailianE2EEnabled()) return false;
  if (process.env.DASHSCOPE_ACCESS_TOKEN?.trim()) return true;
  try {
    const config = readConfigFile();
    return typeof config.access_token === "string" && config.access_token.length > 0;
  } catch {
    return false;
  }
}

describe("e2e: usage tokenplan", () => {
  test("usage 分组展示 tokenplan 子命令帮助且退出码为 0", async () => {
    const { stdout, stderr, exitCode } = await runCli(["usage"]);
    expect(exitCode, stderr).toBe(0);
    const out = `${stdout}\n${stderr}`;
    expect(out).toMatch(/tokenplan/i);
  });

  test("usage tokenplan --help 正常退出", async () => {
    const { stderr, exitCode } = await runCli(["usage", "tokenplan", "--help"]);
    expect(exitCode, stderr).toBe(0);
    expect(stderr).toMatch(/--console-site|token plan|monthly/i);
  });

  test("usage tokenplan --help 包含所有示例", async () => {
    const { stderr, exitCode } = await runCli(["usage", "tokenplan", "--help"]);
    expect(exitCode, stderr).toBe(0);
    expect(stderr).toContain("bl usage tokenplan");
    expect(stderr).toContain("bl usage tokenplan --output json");
    expect(stderr).toContain("bl usage tokenplan --console-site international");
  });
});

describe.skipIf(!isConsoleE2EReady())("e2e: usage tokenplan（Console）", () => {
  test("usage tokenplan --dry-run 输出请求参数不发起调用", async () => {
    const { stdout, stderr, exitCode } = await runCli([
      "usage",
      "tokenplan",
      "--dry-run",
      "--output",
      "json",
    ]);
    expect(exitCode, stderr).toBe(0);
    const data = parseStdoutJson<{ api?: string; data?: Record<string, unknown> }>(stdout);
    expect(data.api).toContain("/tokenplan/personal/api/v2/usage");
    expect(data.data).toEqual({});
  });
});
