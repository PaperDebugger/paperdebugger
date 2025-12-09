import { MutationOptions, UseQueryOptions } from "@tanstack/react-query";

export type UseQueryOptionsOverride<QueryResponse> = Omit<
  UseQueryOptions<QueryResponse, unknown, QueryResponse, readonly string[]>,
  "queryKey" | "queryFn"
>;

export type UseMutationOptionsOverride<MutationResponse> = Omit<
  MutationOptions<MutationResponse, unknown, unknown, unknown>,
  "mutationKey" | "mutationFn"
>;

export type PlainMessage<T> = T extends object
  ? {
      [K in keyof T as K extends "$typeName" | "$unknown" ? never : K]: PlainMessage<T[K]>;
    }
  : T;
