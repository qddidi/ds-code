"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var repl_js_1 = require("./src/cli/repl.js");
var apiKey = process.env['DEEPSEEK_API_KEY'];
if (!apiKey) {
    console.error('请设置环境变量 DEEPSEEK_API_KEY');
    console.error('  export DEEPSEEK_API_KEY=sk-xxx');
    process.exit(1);
}
(0, repl_js_1.startRepl)({ apiKey: apiKey });
