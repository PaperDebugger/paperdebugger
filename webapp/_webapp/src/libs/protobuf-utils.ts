import { DescMessage, fromJson as bufFromJson, JsonValue, MessageShape } from "@bufbuild/protobuf";

/**
 * Wrapper around fromJson that ignores unknown fields to prevent crashes
 * when new fields are added to the schema.
 *
 * This allows forward compatibility - older webapp versions can work with
 * newer backend versions that introduce new fields.
 */
export function fromJson<Desc extends DescMessage>(schema: Desc, json: JsonValue): MessageShape<Desc> {
  return bufFromJson(schema, json, {
    ignoreUnknownFields: true,
  });
}
