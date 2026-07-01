import type { BotPolicy } from "../data/boards";

export const VISIBILITY_OPTIONS = [
  {
    value: "private",
    labelKey: "app.visibility.privateLabel",
    shortKey: "app.visibility.privateShort",
    hintKey: "app.visibility.privateHint",
  },
  {
    value: "team",
    labelKey: "app.visibility.teamLabel",
    shortKey: "app.visibility.teamShort",
    hintKey: "app.visibility.teamHint",
  },
  {
    value: "link",
    labelKey: "app.visibility.linkLabel",
    shortKey: "app.visibility.linkShort",
    hintKey: "app.visibility.linkHint",
  },
] as const;

export const BOT_POLICY_OPTIONS = [
  { value: "none", labelKey: "app.bot.none" },
  { value: "read", labelKey: "app.bot.read" },
  { value: "write", labelKey: "app.bot.write" },
] as const;

type BotPolicyLabelKey = typeof BOT_POLICY_OPTIONS[number]["labelKey"];

export const botPolicyLabelKey = (
  policy: BotPolicy | undefined,
): BotPolicyLabelKey =>
  BOT_POLICY_OPTIONS.find((option) => option.value === (policy ?? "write"))
    ?.labelKey ?? "app.bot.write";
