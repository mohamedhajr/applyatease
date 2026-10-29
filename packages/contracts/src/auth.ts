import { Schema } from "effect";

export const AuthUser = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
});
export type AuthUser = typeof AuthUser.Type;
export const AuthCapabilities = Schema.Struct({
  email: Schema.Boolean,
  google: Schema.Boolean,
  apple: Schema.Boolean,
});
export type AuthCapabilities = typeof AuthCapabilities.Type;
export const desktopAuthScheme = "com.applyatease.app";
