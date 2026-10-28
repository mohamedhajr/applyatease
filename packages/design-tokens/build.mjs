import StyleDictionary from "style-dictionary";

await new StyleDictionary({
  source: ["tokens.json"],
  usesDtcg: true,
  platforms: {
    css: {
      transformGroup: "css",
      prefix: "aae",
      buildPath: "dist/",
      files: [{ destination: "theme.css", format: "css/variables" }],
    },
  },
}).buildAllPlatforms();
