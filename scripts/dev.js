const path = require("path");
const { build } = require("esbuild");
// process.argv 进程参数列表
const args = require("minimist")(process.argv.slice(2)); // 解析用户执行命令行的参数
console.log(args);

const target = args._[0] || "reactivity"; // 打包的模块是哪一个
const format = args.f || "global";

// 获取 package.json 文件
const pkg = require(path.resolve(
  __dirname,
  `../packages/${target}/package.json`
));

// 打包格式
const outputFormat = format.startsWith("global")
  ? "iife"
  : format === "cjs"
  ? "cjs"
  : "esm";

// reactivity.global.js reactivity.esm.js reactivity.cjs.js 打包文件位置和名字
const outfile = path.resolve(
  __dirname,
  `../packages/${target}/dist/${target}.${format}.js`
);

build({
  entryPoints: [path.resolve(__dirname, `../packages/${target}/src/index.ts`)],
  outfile,
  bundle: true,
  sourcemap: true,
  format: outputFormat,
  globalName: pkg.buildOptions?.name,
  // watch: {
  //   // 监控文件变化
  //   onRebuild(error, result) {
  //     if (error) console.error("watch build failed:", error);
  //     else console.log("watch build succeeded:", result);
  //   },
  // },
  platform: format === "cjs" ? "node" : "browser",
}).then(() => {
  console.log("watching~~~~");
});
