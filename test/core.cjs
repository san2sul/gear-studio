// dist/index.html의 <script id="core">를 Node에서 불러와 시험에 씀 (화면 없이 기하·설계만)
const fs = require('fs'), path = require('path'), Module = require('module');
const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const core = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const names = ['buildModel', 'gearOutline', 'pointInPoly', 'modelPorts', 'asmDefault', 'asmModel', 'linkageDefault', 'linkMotion', 'linkClash', 'STD', 'proxyParts', 'MOTORS', 'LK_TYPES', 'camDefault', 'pairDesign', 'rackPair', 'bevelPair', 'planetaryPair'];
const src = 'const THREE = require("three");\n' + core + '\nmodule.exports = {' + names.map(n => `${n}: typeof ${n} !== "undefined" ? ${n} : undefined`).join(',') + '};';
const fn = path.join(__dirname, 'core-virtual.cjs'), m = new Module(fn, module); m.filename = fn; m.paths = module.paths; m._compile(src, fn);
module.exports = m.exports;
