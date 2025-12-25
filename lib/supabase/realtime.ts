// ============================================
// Imports
// ============================================

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

import { supabaseClient } from "@/lib/supabase/client";


// ============================================
// Types
// ============================================

export type RealtimeEvent =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "*";

export type RealtimeSubscribeOptions = {
  schema?: string;
  table: string;

  event?: RealtimeEvent;

  filter?: string;

  channelName?: string;
};

export type RealtimeHandler<T> = (
  payload: RealtimePostgresChangesPayload<T>
) => void;

export type RealtimeSubscription = {
  channel: RealtimeChannel;
  unsubscribe: () => Promise<void>;
};


// ============================================
// Subscribe to Postgres Changes
// ============================================

export const subscribeToTable = <T>(
  options: RealtimeSubscribeOptions,
  handler: RealtimeHandler<T>
): RealtimeSubscription => {

  const supabase = supabaseClient();

  const schema = options.schema ?? "public";

  const event = options.event ?? "*";

  const channelName =
    options.channelName ??
    `realtime:${schema}:${options.table}:${event}`;

  const channel = supabase.channel(channelName);

  channel.on(
    "postgres_changes",
    {
      event,
      schema,
      table: options.table,
      filter: options.filter,
    },
    (payload) => {
      handler(payload as RealtimePostgresChangesPayload<T>);
    }
  );

  channel.subscribe();

  const unsubscribe = async () => {
    await supabase.removeChannel(channel);
  };

  return {
    channel,
    unsubscribe,
  };
};


// ============================================
// Subscribe Helpers
// ============================================

export const subscribeInsert = <T>(
  table: string,
  handler: RealtimeHandler<T>,
  filter?: string
) => {

  return subscribeToTable<T>(
    {
      table,
      event: "INSERT",
      filter,
    },
    handler
  );
};

export const subscribeUpdate = <T>(
  table: string,
  handler: RealtimeHandler<T>,
  filter?: string
) => {

  return subscribeToTable<T>(
    {
      table,
      event: "UPDATE",
      filter,
    },
    handler
  );
};

export const subscribeDelete = <T>(
  table: string,
  handler: RealtimeHandler<T>,
  filter?: string
) => {

  return subscribeToTable<T>(
    {
      table,
      event: "DELETE",
      filter,
    },
    handler
  );
};
