import type { BotPolicy, Visibility } from "../data/boards";

export const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  hint: string;
}[] = [
  { value: "private", label: "🔒 Личная", hint: "Только вы и приглашённые" },
  {
    value: "team",
    label: "👥 Командная",
    hint: "Вся команда: зрители смотрят, редакторы правят",
  },
  {
    value: "link",
    label: "🔗 По ссылке",
    hint: "Любой по ссылке — только просмотр",
  },
];

export const BOT_POLICY_OPTIONS: { value: BotPolicy; label: string }[] = [
  { value: "none", label: "нет доступа" },
  { value: "read", label: "только чтение" },
  { value: "write", label: "чтение и запись" },
];
