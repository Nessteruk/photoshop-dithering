import path from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";
import { aliases } from "@swc-uxp-wrappers/utils";

const root = path.dirname(fileURLToPath(import.meta.url));

export default (env, argv) => ({
  mode: argv.mode || "production",
  target: "web",
  entry: { main: "./main.js" },
  output: { path: path.join(root, "dist"), filename: "[name].js", clean: true },
  devtool: false,
  externals: { photoshop: "commonjs2 photoshop", uxp: "commonjs2 uxp" },
  resolve: { alias: aliases, extensions: [".js"] },
  plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
  performance: { hints: false }
});
