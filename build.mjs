// 빌드: build.json에 적힌 순서대로 src 조각을 이어 붙여 HTML 하나(dist/index.html)를 만듭니다.
// 의존 패키지 없음. 실행: node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const cfg = JSON.parse(readFileSync(new URL('./build.json', import.meta.url)));
const out = cfg.files.map(f => readFileSync(new URL('./' + f, import.meta.url), 'utf8')).join('\n');
mkdirSync(dirname(new URL('./' + cfg.out, import.meta.url).pathname), { recursive: true });
writeFileSync(new URL('./' + cfg.out, import.meta.url), out);
console.log(`built ${cfg.out} (${out.split('\n').length} lines, ${cfg.files.length} parts)`);
