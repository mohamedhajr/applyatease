import { Schema } from "effect";

export const Health = Schema.Struct({
  status: Schema.Literals(["ok", "unavailable"]),
});
export type Health = typeof Health.Type;
