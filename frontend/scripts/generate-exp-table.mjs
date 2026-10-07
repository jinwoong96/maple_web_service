/**
 * 레벨별 요구 경험치 테이블을 생성한다.
 *
 *   node scripts/generate-exp-table.mjs
 *
 * 넥슨 API는 이 값을 주지 않는다. `character_exp`가 **현재 레벨 내 경험치**라
 * 레벨이 다르면 단순 뺄셈으로 성장량을 낼 수 없어서, 레벨별 요구치가 필요하다.
 *
 * 런타임에 위키를 fetch하지 않는다 — 외부 사이트 장애나 CORS에 기능이 묶이고,
 * 남의 사이트를 사용자 브라우저에서 매번 때리는 것도 곤란하다. 대신 이
 * 스크립트로 한 번 받아 `.ts`로 떨궈 커밋한다. 패치로 요구치가 바뀌면 다시
 * 돌리면 된다(2~3년에 한 번꼴로 실제로 바뀐다).
 */

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SOURCE_URL = 'https://maplestorywiki.net/w/Experience/Leveling_Tables?action=raw'

/** 이 테이블이 반영하는 마지막 경험치 변경 패치. 생성물에 박아두고, 비교
 * 구간이 이 날짜를 걸치면 화면에서 경고한다. */
const EXP_TABLE_PATCH_DATE = '2026-03-19'

const MAX_LEVEL = 300

async function main() {
  const response = await fetch(SOURCE_URL)
  if (!response.ok) {
    throw new Error(`위키 응답 ${response.status} — 주소가 바뀌었는지 확인하세요: ${SOURCE_URL}`)
  }
  const raw = await response.text()

  // 위키텍스트의 표 행: |<레벨> / |<누적 경험치> / |<다음 레벨까지 요구치>
  const rowPattern = /\n\|(\d{1,3})\n\|([\d,]+|N\/A)\n\|([\d,]+|N\/A)\n/g
  const required = new Map()
  for (const [, levelText, , nextText] of raw.matchAll(rowPattern)) {
    const level = Number(levelText)
    if (level < 1 || level > MAX_LEVEL) continue
    // 만렙(300)은 N/A다. 실제로 `character_exp`가 0으로 고정된다.
    required.set(level, nextText === 'N/A' ? 0 : Number(nextText.replaceAll(',', '')))
  }

  const missing = []
  for (let level = 1; level <= MAX_LEVEL; level++) {
    if (!required.has(level)) missing.push(level)
  }
  if (missing.length > 0) {
    throw new Error(`레벨 ${missing.join(', ')} 값을 못 읽었습니다. 위키 표 형식이 바뀌었을 수 있습니다.`)
  }

  const values = Array.from({ length: MAX_LEVEL }, (_, index) => required.get(index + 1))
  const lines = []
  for (let i = 0; i < values.length; i += 5) {
    lines.push('  ' + values.slice(i, i + 5).map((v) => `${v}n`).join(', ') + ',')
  }

  const output = `// 이 파일은 \`scripts/generate-exp-table.mjs\`가 만듭니다. 직접 고치지 마세요.
// 출처: ${SOURCE_URL}
// 생성: ${new Date().toISOString().slice(0, 10)}

/** 이 테이블이 반영하는 마지막 경험치 변경 패치일.
 *
 * 요구 경험치는 2~3년에 한 번씩 실제로 바뀐다(2018 검은 마법사, 2020 NEO,
 * 2023 NEW AGE, 2026-03-19 23주년). 비교 구간이 이 날짜를 걸치면 그 구간의
 * 성장량이 부정확하므로 화면에서 경고한다. */
export const EXP_TABLE_PATCH_DATE = '${EXP_TABLE_PATCH_DATE}'

/** \`REQUIRED_EXP[level - 1]\` = 그 레벨에서 다음 레벨까지 필요한 경험치.
 *
 * 300레벨은 0이다 — 만렙에 도달하면 \`character_exp\`가 0으로 고정되고 더
 * 쌓이지 않는다(실측: 랭킹 1~8위 전원 \`exp = 0\`).
 *
 * 값이 조 단위까지 가서 \`number\`로는 정밀도가 깨진다(299레벨 요구치가
 * 1,737,759,854,037,637 — \`Number.MAX_SAFE_INTEGER\`를 넘는다). \`bigint\`로 둔다. */
export const REQUIRED_EXP: readonly bigint[] = [
${lines.join('\n')}
]
`

  const here = path.dirname(fileURLToPath(import.meta.url))
  const target = path.join(here, '..', 'src', 'lib', 'exp-table.generated.ts')
  await writeFile(target, output, 'utf8')
  console.log(`${values.length}개 레벨을 썼습니다 -> ${target}`)
  console.log(`  Lv.200 ${values[199]} / Lv.250 ${values[249]} / Lv.299 ${values[298]} / Lv.300 ${values[299]}`)
}

await main()
