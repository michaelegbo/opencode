import "./zen/index.css"
import "./rankings.css"
import { Title } from "@solidjs/meta"
import { createSignal, For, Show } from "solid-js"
import { Footer } from "~/component/footer"
import { Header } from "~/component/header"
import { Legal } from "~/component/legal"
import { LocaleLinks } from "~/component/locale-links"
import { paths as worldPaths } from "./world-paths"

const models = [
  { name: "minimax-m2.5-free", color: "#f25bb2" },
  { name: "big-pickle", color: "#8b5cf6" },
  { name: "mimo-v2-pro-free", color: "#18a57b" },
  { name: "kimi-k2.5-free", color: "#3481cf" },
  { name: "kimi-k2.5", color: "#e4ad27" },
  { name: "minimax-m2.1-free", color: "#ff5a1f" },
  { name: "glm-5-free", color: "#46b786" },
  { name: "gpt-5-nano", color: "#84cc16" },
  { name: "nemotron-3-super-free", color: "#14c2a3" },
  { name: "claude-opus-4-6", color: "#ff7b3d" },
] as const

type Week = {
  week: string
  segments: { model: string; color: string; tokens: number }[]
  total: number
}

const raw: Record<string, Record<string, number>> = {
  "jan-27": {
    "big-pickle": 368743864804,
    "kimi-k2.5-free": 915886375887,
    "kimi-k2.5": 39168495089,
    "minimax-m2.1-free": 270764664177,
    "gpt-5-nano": 41276213376,
  },
  "feb-3": {
    "big-pickle": 520618971808,
    "kimi-k2.5-free": 980317788887,
    "kimi-k2.5": 92823557285,
    "minimax-m2.1-free": 721380871693,
    "gpt-5-nano": 74420810088,
    "claude-opus-4-6": 49826050233,
  },
  "feb-10": {
    "minimax-m2.5-free": 905276977685,
    "big-pickle": 775593605696,
    "kimi-k2.5-free": 546100624556,
    "kimi-k2.5": 106869700825,
    "minimax-m2.1-free": 273479063739,
    "glm-5-free": 21944995438,
    "gpt-5-nano": 86562724981,
    "claude-opus-4-6": 71785580030,
  },
  "feb-17": {
    "minimax-m2.5-free": 1313909105944,
    "big-pickle": 1017431400927,
    "kimi-k2.5-free": 350112011799,
    "kimi-k2.5": 100616295719,
    "minimax-m2.1-free": 11269742719,
    "glm-5-free": 735726749938,
    "gpt-5-nano": 79036772388,
    "claude-opus-4-6": 66789922519,
  },
  "feb-24": {
    "minimax-m2.5-free": 1988229542028,
    "big-pickle": 1332574843957,
    "kimi-k2.5-free": 17964822381,
    "kimi-k2.5": 152009783828,
    "minimax-m2.1-free": 10376282858,
    "glm-5-free": 3848233361,
    "gpt-5-nano": 94195723658,
    "claude-opus-4-6": 72579249230,
  },
  "mar-3": {
    "minimax-m2.5-free": 1103526073812,
    "big-pickle": 864075264151,
    "kimi-k2.5": 236732504356,
    "gpt-5-nano": 62076480967,
    "claude-opus-4-6": 75122544903,
  },
  "mar-10": {
    "minimax-m2.5-free": 1765538911999,
    "big-pickle": 1456821813321,
    "kimi-k2.5": 270005019814,
    "gpt-5-nano": 80064940458,
    "nemotron-3-super-free": 226767628611,
    "claude-opus-4-6": 121826865344,
  },
  "mar-17": {
    "minimax-m2.5-free": 2258964526070,
    "big-pickle": 2157757939980,
    "mimo-v2-pro-free": 1393092895745,
    "kimi-k2.5": 253277628360,
    "gpt-5-nano": 91075743861,
    "nemotron-3-super-free": 257336931857,
    "claude-opus-4-6": 107180831444,
  },
  "mar-24": {
    "minimax-m2.5-free": 2256417941175,
    "big-pickle": 2596072141208,
    "mimo-v2-pro-free": 1612680626347,
    "kimi-k2.5": 263140655381,
    "gpt-5-nano": 130043140955,
    "nemotron-3-super-free": 254171104198,
    "claude-opus-4-6": 107813898809,
  },
}

const totals: Record<string, number> = {
  "jan-27": 1954431878631,
  "feb-3": 2782873471532,
  "feb-10": 2982021636344,
  "feb-17": 3898395901667,
  "feb-24": 3980255846812,
  "mar-3": 2789862168396,
  "mar-10": 4672779512356,
  "mar-17": 7453410720062,
  "mar-24": 8434615944207,
}

const weeks = ["jan-27", "feb-3", "feb-10", "feb-17", "feb-24", "mar-3", "mar-10", "mar-17", "mar-24"]
const labels: Record<string, string> = {
  "jan-27": "Jan 27",
  "feb-3": "Feb 3",
  "feb-10": "Feb 10",
  "feb-17": "Feb 17",
  "feb-24": "Feb 24",
  "mar-3": "Mar 3",
  "mar-10": "Mar 10",
  "mar-17": "Mar 17",
  "mar-24": "Mar 24",
}

const usage: Week[] = weeks.map((key) => {
  const data = raw[key]
  const total = totals[key]
  const named = models.filter((m) => data[m.name]).map((m) => ({ model: m.name, color: m.color, tokens: data[m.name] }))
  const rest = total - named.reduce((sum, s) => sum + s.tokens, 0)
  return {
    week: labels[key],
    total,
    segments: [...named, { model: "Other", color: "rgba(148, 163, 184, 0.35)", tokens: rest }],
  }
})

const max = Math.max(...usage.map((w) => w.total))

const fmt = (n: number) => {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`
  return `${(n / 1e9).toFixed(0)}B`
}

const leaderboard = [
  { rank: 1, model: "big-pickle", tokens: 2_596_072_141_208 },
  { rank: 2, model: "minimax-m2.5-free", tokens: 2_256_417_941_175 },
  { rank: 3, model: "mimo-v2-pro-free", tokens: 1_612_680_626_347 },
  { rank: 4, model: "mimo-v2-omni-free", tokens: 313_963_070_777 },
  { rank: 5, model: "kimi-k2.5", tokens: 263_140_655_381 },
  { rank: 6, model: "nemotron-3-super-free", tokens: 254_171_104_198 },
  { rank: 7, model: "minimax-m2.7", tokens: 235_471_532_073 },
  { rank: 8, model: "qwen3.6-plus-free", tokens: 211_645_852_696 },
  { rank: 9, model: "glm-5", tokens: 149_968_059_435 },
  { rank: 10, model: "gpt-5-nano", tokens: 130_043_140_955 },
  { rank: 11, model: "claude-opus-4-6", tokens: 107_813_898_809 },
  { rank: 12, model: "minimax-m2.5", tokens: 91_477_876_330 },
  { rank: 13, model: "gpt-5.4", tokens: 64_216_544_736 },
  { rank: 14, model: "claude-sonnet-4-6", tokens: 53_638_240_479 },
  { rank: 15, model: "gpt-5.3-codex", tokens: 31_928_019_743 },
  { rank: 16, model: "gemini-3-flash", tokens: 14_528_488_448 },
  { rank: 17, model: "claude-haiku-4-5", tokens: 8_921_076_835 },
  { rank: 18, model: "gemini-3.1-pro", tokens: 7_676_935_166 },
  { rank: 19, model: "claude-sonnet-4-5", tokens: 5_051_555_617 },
  { rank: 20, model: "gpt-5.4-mini", tokens: 4_751_125_737 },
]

const providers = [
  { name: "opencode", color: "#8b5cf6" },
  { name: "minimax", color: "#f25bb2" },
  { name: "xiaomi", color: "#ff5a1f" },
  { name: "moonshot", color: "#3481cf" },
  { name: "nvidia", color: "#14c2a3" },
  { name: "openai", color: "#84cc16" },
  { name: "anthropic", color: "#ff7b3d" },
  { name: "zhipu", color: "#46b786" },
  { name: "google", color: "#e4ad27" },
  { name: "alibaba", color: "#ef5db1" },
  { name: "arcee", color: "#2085ec" },
] as const

const shareRaw: Record<string, Record<string, number>> = {
  "jan-27": {
    moonshot: 957101046076,
    opencode: 368743864804,
    minimax: 273789245099,
    zhipu: 175220173052,
    openai: 71428726197,
    anthropic: 63795092028,
    arcee: 22900709163,
    google: 21116481943,
    alibaba: 336540269,
  },
  "feb-3": {
    moonshot: 1075728836899,
    minimax: 727777460147,
    opencode: 520618971808,
    anthropic: 126083048915,
    openai: 119992167519,
    zhipu: 106315324243,
    arcee: 70511760645,
    google: 35345191581,
    alibaba: 500567954,
  },
  "feb-10": {
    minimax: 1195064506114,
    opencode: 775593605696,
    moonshot: 655693064959,
    openai: 126021773769,
    anthropic: 114969689993,
    zhipu: 66447874989,
    google: 27728156767,
    arcee: 20502880487,
  },
  "feb-17": {
    minimax: 1340689075939,
    opencode: 1017431400927,
    zhipu: 753486920157,
    moonshot: 453006079914,
    anthropic: 136280713749,
    openai: 117036878336,
    google: 44709966980,
    arcee: 35460739820,
  },
  "feb-24": {
    minimax: 2037390464296,
    opencode: 1332574843957,
    moonshot: 172345287072,
    openai: 165404921924,
    anthropic: 137007019288,
    arcee: 65348467867,
    zhipu: 36192647725,
    google: 32632757942,
  },
  "mar-3": {
    minimax: 1236589693899,
    opencode: 864075264151,
    moonshot: 236940261927,
    openai: 144296631970,
    anthropic: 143388311109,
    zhipu: 89420861866,
    google: 35499950281,
    xiaomi: 24396507662,
    arcee: 14674544044,
  },
  "mar-10": {
    minimax: 1919467888084,
    opencode: 1456821813321,
    xiaomi: 302031698856,
    moonshot: 270021430246,
    nvidia: 226767628611,
    anthropic: 181566633371,
    openai: 171713393912,
    zhipu: 113460952065,
    google: 30109971757,
    arcee: 818102133,
  },
  "mar-17": {
    minimax: 2536581988215,
    opencode: 2157757939980,
    xiaomi: 1708313298084,
    nvidia: 257336931857,
    moonshot: 253304780525,
    openai: 196305815207,
    anthropic: 188087354693,
    zhipu: 127277270842,
    google: 28180238053,
    arcee: 265058488,
  },
  "mar-24": {
    opencode: 2596072141208,
    minimax: 2583441903425,
    xiaomi: 1930671539776,
    moonshot: 263142158847,
    nvidia: 254171104198,
    openai: 242821016755,
    alibaba: 211645852696,
    anthropic: 179934787304,
    zhipu: 150050493012,
    google: 22325363704,
    arcee: 336333746,
  },
}

const share = weeks.map((key) => {
  const data = shareRaw[key]
  const total = totals[key]
  const segs = providers
    .filter((p) => data[p.name])
    .map((p) => ({
      provider: p.name,
      color: p.color,
      tokens: data[p.name],
      pct: (data[p.name] / total) * 100,
    }))
  return { week: labels[key], total, segments: segs }
})

const pricing: Record<string, { input: number; output: number; cached: number }> = {
  "kimi-k2.5": { input: 0.6, output: 3.0, cached: 0.1 },
  "minimax-m2.7": { input: 0.3, output: 1.2, cached: 0.06 },
  "glm-5": { input: 1.0, output: 3.2, cached: 0.2 },
  "claude-opus-4-6": { input: 5.0, output: 25.0, cached: 0.5 },
  "minimax-m2.5": { input: 0.3, output: 1.2, cached: 0.03 },
  "gpt-5.4": { input: 2.5, output: 15.0, cached: 0.25 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cached: 0.3 },
  "gpt-5.3-codex": { input: 1.75, output: 14.0, cached: 0.175 },
  "gemini-3-flash": { input: 0.5, output: 3.0, cached: 0.05 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0, cached: 0.1 },
  "gemini-3.1-pro": { input: 2.0, output: 12.0, cached: 0.2 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0, cached: 0.3 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5, cached: 0.075 },
}

const effective = (p: { input: number; output: number; cached: number }) =>
  p.cached * 0.94 + p.input * 0.06 + p.output * 0.01

const price = (n: number) => (n === 0 ? "Free" : `$${n.toFixed(2)}`)

const modelGroup: Record<string, string> = {
  "kimi-k2.5": "moonshot",
  "minimax-m2.7": "minimax",
  "minimax-m2.5": "minimax",
  "glm-5": "zhipu",
  "claude-opus-4-6": "anthropic",
  "claude-sonnet-4-6": "anthropic",
  "claude-sonnet-4-5": "anthropic",
  "claude-haiku-4-5": "anthropic",
  "gpt-5.4": "openai",
  "gpt-5.3-codex": "openai",
  "gpt-5.4-mini": "openai",
  "gemini-3-flash": "google",
  "gemini-3.1-pro": "google",
}

const pricedModels = leaderboard
  .filter((r) => !r.model.endsWith("-free") && pricing[r.model])
  .sort((a, b) => effective(pricing[a.model]) - effective(pricing[b.model]))

const maxEffective = Math.max(...pricedModels.map((r) => effective(pricing[r.model])))

const grouped = (() => {
  const groups: { provider: string; models: typeof pricedModels }[] = []
  const seen = new Set<string>()
  for (const row of pricedModels) {
    const g = modelGroup[row.model] || row.model
    if (seen.has(g)) continue
    seen.add(g)
    const items = pricedModels.filter((r) => (modelGroup[r.model] || r.model) === g)
    groups.push({ provider: g, models: items })
  }
  return groups
})()

const sessions = [
  { model: "gpt-5.4-nano", spend: 56.19, sessions: 2469, tokens: 2_058_320_992 },
  { model: "gpt-5.1-codex-mini", spend: 46.49, sessions: 649, tokens: 1_114_706_819 },
  { model: "minimax-m2.5", spend: 10774.93, sessions: 101862, tokens: 91_512_287_752 },
  { model: "claude-haiku-4-5", spend: 2169.56, sessions: 14896, tokens: 8_965_515_678 },
  { model: "gpt-5.4-mini", spend: 858.63, sessions: 4726, tokens: 4_759_454_622 },
  { model: "minimax-m2.7", spend: 24120.99, sessions: 118523, tokens: 235_267_498_689 },
  { model: "gpt-5.4", spend: 31834.9, sessions: 142909, tokens: 64_146_279_556 },
  { model: "kimi-k2.5", spend: 39724.09, sessions: 150135, tokens: 263_660_128_320 },
  { model: "gemini-3-flash", spend: 2294.28, sessions: 8405, tokens: 14_752_884_651 },
  { model: "glm-5", spend: 37814.87, sessions: 105292, tokens: 150_626_981_063 },
  { model: "claude-sonnet-4-6", spend: 32133.34, sessions: 42237, tokens: 53_550_067_871 },
  { model: "gpt-5.3-codex", spend: 10809.82, sessions: 13888, tokens: 31_907_600_634 },
  { model: "claude-sonnet-4-5", spend: 4061.09, sessions: 4057, tokens: 5_157_076_730 },
  { model: "gemini-3.1-pro", spend: 6257.1, sessions: 5777, tokens: 7_569_358_077 },
  { model: "claude-opus-4-6", spend: 114219.22, sessions: 42550, tokens: 106_575_958_684 },
  { model: "claude-opus-4-5", spend: 3582.53, sessions: 1576, tokens: 3_219_688_476 },
  { model: "gpt-5.4-pro", spend: 6555.13, sessions: 1264, tokens: 200_314_429 },
]

const avg = (r: (typeof sessions)[number]) => r.spend / r.sessions
const avgTokens = (r: (typeof sessions)[number]) => Math.round(r.tokens / r.sessions)

const fmtTokens = (n: number) => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(n)
}

const maxTps = Math.max(...sessions.map((r) => avgTokens(r)))

const countries: Record<string, number> = {
  CN: 1_954_638_555_964,
  US: 893_134_696_046,
  IN: 535_643_693_640,
  BR: 382_163_396_828,
  DE: 311_242_520_442,
  ES: 209_329_692_495,
  RU: 201_527_328_150,
  HK: 196_512_051_704,
  GB: 166_553_586_780,
  AR: 162_194_105_984,
  SG: 158_456_781_083,
  FR: 156_789_513_531,
  JP: 152_176_549_930,
  NL: 142_283_579_531,
  ID: 133_099_866_730,
  CA: 130_175_404_155,
  IT: 104_164_651_206,
  MX: 103_470_313_882,
  TW: 99_750_103_092,
  CO: 96_782_169_230,
  VN: 89_760_456_363,
  PL: 87_055_503_038,
  TR: 83_380_620_873,
  KR: 82_692_257_401,
  AU: 82_626_936_402,
  PH: 63_600_637_182,
  EG: 61_672_925_246,
  PT: 55_231_430_725,
  BD: 54_398_663_664,
  SE: 53_569_291_560,
  CL: 52_319_761_865,
  TH: 50_343_490_695,
  NG: 50_159_406_105,
  PK: 49_490_412_870,
  FI: 45_825_535_387,
  PE: 43_961_712_555,
  CH: 43_300_038_112,
  MY: 41_561_444_011,
  RO: 40_383_208_346,
  BE: 38_322_022_514,
  MA: 38_272_211_062,
  ZA: 38_180_939_069,
  UA: 36_032_426_930,
  VE: 34_807_973_969,
  KE: 34_239_081_597,
  IL: 32_705_941_531,
  AT: 31_995_376_039,
  DZ: 29_533_977_612,
  CZ: 28_976_529_740,
  NP: 25_623_967_353,
  DO: 23_957_780_174,
  DK: 22_736_971_721,
  EC: 21_934_976_342,
  AE: 21_823_728_235,
  TN: 21_412_135_454,
  NO: 20_735_253_026,
  SA: 20_234_711_215,
  BY: 18_939_368_533,
  GH: 16_936_621_597,
  RS: 16_778_051_855,
  NZ: 16_319_979_678,
  ET: 15_465_960_765,
  IE: 14_978_507_068,
  BO: 14_833_821_684,
  GR: 14_785_265_286,
  HU: 14_540_890_452,
  UY: 13_804_790_917,
  UZ: 13_008_621_109,
  LK: 12_735_597_659,
  BG: 12_045_851_521,
  CR: 11_261_069_513,
  PY: 10_614_168_600,
  KH: 10_555_315_979,
  KZ: 10_159_168_104,
  LT: 9_815_793_110,
  EE: 9_417_177_100,
  UG: 9_165_111_455,
  SK: 9_070_826_870,
  LV: 8_198_013_338,
  IQ: 8_187_011_695,
  HR: 7_605_019_662,
  CM: 7_377_050_916,
  ZW: 7_314_742_432,
  YE: 6_747_216_591,
  JO: 6_211_747_207,
  PA: 6_092_366_683,
  QA: 5_955_042_936,
  MD: 5_773_585_201,
  TZ: 5_625_754_397,
  NI: 5_228_293_282,
  GE: 5_165_628_063,
  SI: 4_955_336_900,
  SN: 4_688_066_204,
  BA: 4_549_605_753,
  BJ: 4_543_143_957,
  GT: 4_424_503_835,
  HN: 4_405_852_608,
  OM: 4_395_319_849,
}

const maxCountry = Math.max(...Object.values(countries))

const names: Record<string, string> = {
  CN: "China",
  US: "United States",
  IN: "India",
  BR: "Brazil",
  DE: "Germany",
  ES: "Spain",
  RU: "Russia",
  HK: "Hong Kong",
  GB: "United Kingdom",
  AR: "Argentina",
  SG: "Singapore",
  FR: "France",
  JP: "Japan",
  NL: "Netherlands",
  ID: "Indonesia",
  CA: "Canada",
  IT: "Italy",
  MX: "Mexico",
  TW: "Taiwan",
  CO: "Colombia",
  VN: "Vietnam",
  PL: "Poland",
  TR: "Turkey",
  KR: "South Korea",
  AU: "Australia",
  PH: "Philippines",
  EG: "Egypt",
  PT: "Portugal",
  BD: "Bangladesh",
  SE: "Sweden",
  CL: "Chile",
  TH: "Thailand",
  NG: "Nigeria",
  PK: "Pakistan",
  FI: "Finland",
  PE: "Peru",
  CH: "Switzerland",
  MY: "Malaysia",
  RO: "Romania",
  BE: "Belgium",
  MA: "Morocco",
  ZA: "South Africa",
  UA: "Ukraine",
  VE: "Venezuela",
  KE: "Kenya",
  IL: "Israel",
  AT: "Austria",
  DZ: "Algeria",
  CZ: "Czechia",
  NP: "Nepal",
  DO: "Dominican Republic",
  DK: "Denmark",
  EC: "Ecuador",
  AE: "UAE",
  TN: "Tunisia",
  NO: "Norway",
  SA: "Saudi Arabia",
  BY: "Belarus",
  GH: "Ghana",
  RS: "Serbia",
  NZ: "New Zealand",
  ET: "Ethiopia",
  IE: "Ireland",
  BO: "Bolivia",
  GR: "Greece",
  HU: "Hungary",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  LK: "Sri Lanka",
  BG: "Bulgaria",
  CR: "Costa Rica",
  PY: "Paraguay",
  KH: "Cambodia",
  KZ: "Kazakhstan",
  LT: "Lithuania",
  EE: "Estonia",
  UG: "Uganda",
  SK: "Slovakia",
  LV: "Latvia",
  IQ: "Iraq",
  HR: "Croatia",
  CM: "Cameroon",
  ZW: "Zimbabwe",
  YE: "Yemen",
  JO: "Jordan",
  PA: "Panama",
  QA: "Qatar",
  MD: "Moldova",
  TZ: "Tanzania",
  NI: "Nicaragua",
  GE: "Georgia",
  SI: "Slovenia",
  SN: "Senegal",
  BA: "Bosnia",
  BJ: "Benin",
  GT: "Guatemala",
  HN: "Honduras",
  OM: "Oman",
}

const flag = (code: string) => String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

const fill = (code: string) => {
  const val = countries[code]
  if (!val) return "var(--color-border-weak)"
  const t = Math.pow(Math.log(val) / Math.log(maxCountry), 1.5)
  const s = 50 + t * 40
  const l = 92 - t * 60
  return `hsl(220, ${s}%, ${l}%)`
}

export default function Rankings() {
  const [active, setActive] = createSignal<number | null>(null)
  const [pos, setPos] = createSignal({ x: 0, y: 0 })
  const [expanded, setExpanded] = createSignal(false)
  const [shareActive, setShareActive] = createSignal<number | null>(null)
  const [sharePos, setSharePos] = createSignal({ x: 0, y: 0 })
  const [mapHover, setMapHover] = createSignal<string | null>(null)
  const [mapPos, setMapPos] = createSignal({ x: 0, y: 0 })

  return (
    <main data-page="zen" data-route="rankings">
      <Title>Model Rankings</Title>
      <LocaleLinks path="/rankings" />

      <div data-component="container">
        <Header zen hideGetStarted />

        <div data-component="content">
          <section data-component="hero" data-variant="rankings">
            <div data-slot="hero-copy">
              <h1>Model Rankings</h1>
              <p>
                See which models are winning real usage, how the mix shifts over time, and where momentum is moving each
                week.
              </p>
            </div>
          </section>

          <section data-component="rankings-section">
            <h3>Usage</h3>
            <div data-slot="chart">
              <div
                data-slot="bars"
                onMouseLeave={() => setActive(null)}
                onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
              >
                <For each={usage}>
                  {(week, i) => (
                    <div
                      data-slot="bar-group"
                      data-active={active() === i() ? "" : undefined}
                      data-dimmed={active() !== null && active() !== i() ? "" : undefined}
                      onMouseEnter={() => setActive(i())}
                    >
                      <span data-slot="bar-label">{fmt(week.total)}</span>
                      <div data-slot="bar-wrap">
                        <div data-slot="bar" style={{ height: `${(week.total / max) * 100}%` }}>
                          <For each={week.segments}>
                            {(seg) => (
                              <span
                                style={{
                                  flex: String(seg.tokens),
                                  background: seg.color,
                                }}
                              />
                            )}
                          </For>
                        </div>
                      </div>
                      <span data-slot="bar-week">{week.week}</span>
                    </div>
                  )}
                </For>
              </div>
              <Show when={active() !== null}>
                <div
                  data-slot="tooltip"
                  style={{
                    left: `${pos().x + 16}px`,
                    top: `${pos().y - 16}px`,
                  }}
                >
                  <strong>{usage[active()!].week}</strong>
                  <span data-slot="tooltip-total">{fmt(usage[active()!].total)} total</span>
                  <For each={usage[active()!].segments.filter((s) => s.tokens > 0)}>
                    {(seg) => (
                      <span data-slot="tooltip-row">
                        <i style={{ background: seg.color }} />
                        <span>{seg.model}</span>
                        <span>{fmt(seg.tokens)}</span>
                      </span>
                    )}
                  </For>
                </div>
              </Show>
              <div data-slot="legend">
                <For each={models}>
                  {(m) => (
                    <span data-slot="legend-item">
                      <i style={{ background: m.color }} />
                      {m.name}
                    </span>
                  )}
                </For>
                <span data-slot="legend-item">
                  <i style={{ background: "rgba(148, 163, 184, 0.35)" }} />
                  Other
                </span>
              </div>
            </div>
          </section>

          <section data-component="rankings-section">
            <h3>Leaderboard</h3>
            <p data-slot="subtitle">Week of Mar 24 — top models by token usage.</p>
            <div data-slot="lb-podium">
              <For each={leaderboard.slice(0, 3)}>
                {(row) => (
                  <div data-slot="lb-podium-item" data-rank={row.rank}>
                    <span data-slot="lb-podium-rank">{row.rank}</span>
                    <strong>{row.model}</strong>
                    <span data-slot="lb-podium-tokens">{fmt(row.tokens)}</span>
                  </div>
                )}
              </For>
            </div>
            <div data-slot="leaderboard">
              <For
                each={[
                  leaderboard.slice(3, expanded() ? 13 : 8),
                  leaderboard.slice(expanded() ? 13 : 8, expanded() ? leaderboard.length : 13),
                ]}
              >
                {(col) => (
                  <div data-slot="lb-col">
                    <For each={col}>
                      {(row) => (
                        <article data-slot="lb-row">
                          <span data-slot="lb-rank">{row.rank}.</span>
                          <div data-slot="lb-info">
                            <strong>{row.model}</strong>
                          </div>
                          <span data-slot="lb-tokens">{fmt(row.tokens)}</span>
                        </article>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
            <Show when={leaderboard.length > 13}>
              <button data-slot="lb-toggle" onClick={() => setExpanded(!expanded())}>
                {expanded() ? "Show less" : "Show all"}
              </button>
            </Show>
          </section>

          <section data-component="rankings-section">
            <h3>Market Share</h3>
            <div data-slot="chart">
              <div
                data-slot="share-bars"
                onMouseLeave={() => setShareActive(null)}
                onMouseMove={(e) => setSharePos({ x: e.clientX, y: e.clientY })}
              >
                <For each={share}>
                  {(week, i) => (
                    <div
                      data-slot="share-col"
                      data-dimmed={shareActive() !== null && shareActive() !== i() ? "" : undefined}
                      onMouseEnter={() => setShareActive(i())}
                    >
                      <div data-slot="share-stack">
                        <For each={week.segments}>
                          {(seg) => <span style={{ flex: String(seg.pct), background: seg.color }} />}
                        </For>
                      </div>
                      <span data-slot="share-week">{week.week}</span>
                    </div>
                  )}
                </For>
              </div>
              <Show when={shareActive() !== null}>
                <div
                  data-slot="tooltip"
                  style={{
                    left: `${sharePos().x + 16}px`,
                    top: `${sharePos().y - 16}px`,
                  }}
                >
                  <strong>{share[shareActive()!].week}</strong>
                  <span data-slot="tooltip-total">{fmt(share[shareActive()!].total)} total</span>
                  <For each={share[shareActive()!].segments.filter((s) => s.tokens > 0)}>
                    {(seg) => (
                      <span data-slot="tooltip-row">
                        <i style={{ background: seg.color }} />
                        <span>{seg.provider}</span>
                        <span>{seg.pct.toFixed(1)}%</span>
                      </span>
                    )}
                  </For>
                </div>
              </Show>
              <div data-slot="legend">
                <For each={providers}>
                  {(p) => (
                    <span data-slot="legend-item">
                      <i style={{ background: p.color }} />
                      {p.name}
                    </span>
                  )}
                </For>
              </div>
            </div>
          </section>

          <section data-component="rankings-section">
            <h3>Token Cost</h3>
            <p data-slot="subtitle">Price per 1M tokens on OpenCode Zen.</p>
            <div data-slot="cost-list">
              <For each={grouped}>
                {(group) => (
                  <div data-slot="cost-group">
                    <For each={group.models}>
                      {(row) => {
                        const p = pricing[row.model]
                        const eff = effective(p)
                        return (
                          <div data-slot="cost-row">
                            <div data-slot="cost-main">
                              <span data-slot="pricing-model">{row.model}</span>
                              <span data-slot="pricing-effective">{price(eff)}</span>
                              <span data-slot="cost-bar-wrap">
                                <span data-slot="cost-bar" style={{ width: `${(eff / maxEffective) * 100}%` }} />
                              </span>
                            </div>
                            <div data-slot="cost-detail">
                              <span>Input {price(p.input)}</span>
                              <span>Output {price(p.output)}</span>
                              <span>Cached {price(p.cached)}</span>
                            </div>
                          </div>
                        )
                      }}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </section>

          <section data-component="rankings-section">
            <h3>Session Cost</h3>
            <p data-slot="subtitle">Average cost per session on OpenCode Zen.</p>
            <div data-slot="pricing-table">
              <div data-slot="pricing-header" data-cols="3">
                <span>Model</span>
                <span>Cost / Session</span>
                <span>Tokens / Session</span>
              </div>
              <For each={sessions}>
                {(row) => (
                  <div data-slot="pricing-row" data-cols="3">
                    <span data-slot="pricing-model">{row.model}</span>
                    <span data-slot="pricing-effective">${avg(row).toFixed(4)}</span>
                    <span data-slot="tps-cell" title={fmtTokens(avgTokens(row))}>
                      <span data-slot="tps-bar" style={{ width: `${(avgTokens(row) / maxTps) * 100}%` }} />
                    </span>
                  </div>
                )}
              </For>
            </div>
          </section>

          <section data-component="rankings-section">
            <h3>Token by Country</h3>
            <div data-slot="map-wrap" onMouseLeave={() => setMapHover(null)}>
              <svg
                data-slot="world-map"
                viewBox="30.767 241.591 784.077 458.627"
                onMouseMove={(e) => setMapPos({ x: e.clientX, y: e.clientY })}
              >
                <For each={Object.entries(worldPaths)}>
                  {([code, d]) => (
                    <path
                      d={d}
                      fill={fill(code)}
                      stroke="var(--color-background)"
                      stroke-width="0.5"
                      onMouseEnter={() => setMapHover(code)}
                      onMouseLeave={() => setMapHover(null)}
                    />
                  )}
                </For>
              </svg>
              <Show when={mapHover() && countries[mapHover()!]}>
                <div
                  data-slot="tooltip"
                  style={{
                    left: `${mapPos().x + 16}px`,
                    top: `${mapPos().y - 16}px`,
                  }}
                >
                  <strong>
                    {flag(mapHover()!)} {names[mapHover()!] || mapHover()}
                  </strong>
                  <span data-slot="tooltip-total">{fmt(countries[mapHover()!])}</span>
                </div>
              </Show>
            </div>
          </section>

          <Footer />
        </div>
      </div>

      <Legal />
    </main>
  )
}
