import {
  defineCommand,
  callConsoleGateway,
  resolveConsoleGatewayCredential,
  detectOutputFormat,
  type Config,
} from "bailian-cli-core";
import { emitResult } from "../../output/output.ts";
import { displayWidth, padEnd } from "../../output/cjk-width.ts";

const USAGE_API = "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/usage";

interface TokenPlanUsage {
  per1MonthPercentage?: number;
  per1MonthResetTime?: number;
}

function getNestedRecord(
  obj: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const val = obj[key];
  if (val && typeof val === "object" && !Array.isArray(val)) return val as Record<string, unknown>;
  return undefined;
}

function extractResponseData(result: Record<string, unknown>): Record<string, unknown> {
  const data = getNestedRecord(result, "data");
  if (!data) return result;

  const dataV2 = getNestedRecord(data, "DataV2");
  if (dataV2) {
    const inner = getNestedRecord(dataV2, "data");
    const innerData = inner ? getNestedRecord(inner, "data") : undefined;
    return innerData ?? inner ?? dataV2;
  }

  const direct = getNestedRecord(data, "data");
  return direct ?? data;
}

// 百分比转换：0.85 → 85%，保留两位小数，最多 100%（对齐前端 usage-consumption 口径）
function toPercentValue(value: number): number {
  return Math.min(Number((value * 100).toFixed(2)), 100);
}

function formatPercentage(value?: number): string {
  if (value === undefined || value === null) return "-";
  return `${toPercentValue(value)}%`;
}

// 格式化毫秒时间戳为固定 UTC+8 时区的可读时间
function formatResetTime(ts?: number): string {
  if (!ts) return "-";
  const date = new Date(ts + 8 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (UTC+8)`;
}

export default defineCommand({
  name: "usage tokenplan",
  description: "Query personal Token Plan usage (monthly window)",
  skipDefaultApiKeySetup: true,
  usage: "bl usage tokenplan [flags]",
  options: [
    { flag: "--console-region <region>", description: "Console region" },
    {
      flag: "--console-site <site>",
      description: "Console site: domestic, international",
    },
    {
      flag: "--console-switch-agent <uid>",
      description: "Switch agent UID",
      type: "number",
    },
  ],
  examples: [
    "bl usage tokenplan",
    "bl usage tokenplan --output json",
    "bl usage tokenplan --console-site international",
  ],
  async run(config: Config) {
    const format = detectOutputFormat(config.output);

    if (config.dryRun) {
      emitResult({ api: USAGE_API, data: {} }, format);
      return;
    }

    const credential = await resolveConsoleGatewayCredential(config);

    const result = await callConsoleGateway(config, credential.token, {
      api: USAGE_API,
      data: {},
    });

    const resp = extractResponseData(result as Record<string, unknown>) as TokenPlanUsage;
    const percentage = resp.per1MonthPercentage;
    const resetTime = resp.per1MonthResetTime;

    if (format === "json") {
      emitResult(
        {
          monthlyUsagePercent:
            percentage === undefined || percentage === null ? null : toPercentValue(percentage),
          monthlyResetTime: resetTime ? formatResetTime(resetTime) : null,
        },
        format,
      );
      return;
    }

    if (percentage === undefined && resetTime === undefined) {
      process.stdout.write("No usage data found.\n");
      return;
    }

    const noColor = config.noColor;
    const bold = noColor ? (text: string) => text : (text: string) => `\x1b[1m${text}\x1b[0m`;

    const rows: [string, string][] = [
      ["Monthly Usage", formatPercentage(percentage)],
      ["Monthly Reset Time", formatResetTime(resetTime)],
    ];

    const maxLabel = Math.max(...rows.map(([label]) => displayWidth(label)));
    for (const [label, value] of rows) {
      process.stdout.write(`${bold(padEnd(label, maxLabel + 2))}${value}\n`);
    }
  },
});
