import type { QueueTask } from "./queue";

declare global {
  interface Env {
    TASK_QUEUE?: Queue<QueueTask>;
    R2_BUCKET?: R2Bucket;
    SITE_URL?: string;
    CACHE_KV?: KVNamespace;
    CACHE_STORAGE_MODE?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
  }
}

export {};
