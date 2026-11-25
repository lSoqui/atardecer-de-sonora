// La escena de «Atardecer de Sonora»: una función pura de (hasta dónde va el
// atardecer, qué hora es) a un texto SVG. Sin comentarios dentro del SVG: el
// motor lee hasta sus palabras.

export const SHIFT_S = 7

type RGB = [number, number, number]

const W = 1600
const H = 900

function parse(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function toHex(color: RGB): string {
  return `#${color
    .map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
    .join('')}`
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k
}

function r(n: number): number {
  return Math.round(n * 100) / 100
}

// Segmento de una rampa de claves {t, v} donde cae `t`, y cuánto avanza dentro.
function span<V>(keys: readonly { t: number; v: V }[], t: number): [V, V, number] {
  const first = keys[0]!
  const last = keys[keys.length - 1]!

  if (t <= first.t) {
    return [first.v, first.v, 0]
  }

  if (t >= last.t) {
    return [last.v, last.v, 0]
  }

  for (let i = 1; i < keys.length; i += 1) {
    const a = keys[i - 1]!
    const b = keys[i]!

    if (t <= b.t) {
      return [a.v, b.v, (t - a.t) / (b.t - a.t)]
    }
  }

  return [last.v, last.v, 0]
}

function color(keys: readonly { t: number; v: string }[], t: number): string {
  const [a, b, k] = span(keys, t)
  const from = parse(a)
  const to = parse(b)

  return toHex([lerp(from[0], to[0], k), lerp(from[1], to[1], k), lerp(from[2], to[2], k)])
}

function num(keys: readonly { t: number; v: number }[], t: number): number {
  const [a, b, k] = span(keys, t)

  return lerp(a, b, k)
}

// Las cinco paradas del cielo, de arriba al horizonte, según el momento (0 a 1).
const SKY: readonly { t: number; v: readonly string[] }[] = [
  { t: 0, v: ['#f1b34c', '#f5c25d', '#f9d273', '#fce092', '#fff0c0'] },
  { t: 0.35, v: ['#e8903f', '#f09d49', '#f5b05a', '#f9c372', '#fdd898'] },
  { t: 0.6, v: ['#9b4f8e', '#d0607e', '#f08850', '#f8ac57', '#fdcd76'] },
  { t: 0.8, v: ['#5a3484', '#a64582', '#e3655a', '#f58b49', '#fbb55a'] },
  { t: 1, v: ['#241a4d', '#4c2c7a', '#a03f80', '#e9623f', '#f8a13b'] },
]

function ramp(hexes: readonly string[]): readonly { t: number; v: string }[] {
  return SKY.map((key, index) => ({ t: key.t, v: hexes[index]! }))
}

const SUN = ramp(['#fffef5', '#fff8d6', '#ffeeb0', '#ffd27a', '#ffb04d'])
const HALO = ramp(['#fff4c8', '#ffe3a0', '#ffc77a', '#ffa862', '#ff8f4a'])
const GLOW = ramp(['#fff2c4', '#ffd890', '#ffc070', '#ffa050', '#ff8a3a'])
const CLOUD_LIT = ramp(['#fffaf0', '#ffeccc', '#ffc9a8', '#ff9f94', '#f06a98'])
const CLOUD_SHADE = ramp(['#f6e4c0', '#f5cf9c', '#d98a86', '#a85a86', '#6a3a8c'])
const FAR = ramp(['#d9a566', '#c07a56', '#7e4a6e', '#4e2f66', '#2c1b49'])
const NEAR = ramp(['#b57a45', '#9a5a42', '#5a3358', '#36214f', '#1d1233'])
const GROUND = ramp(['#8b5a30', '#6e4130', '#40253f', '#27173a', '#140c26'])
const CACTUS = ramp(['#5e3b22', '#4a2c26', '#2c1a30', '#1d1230', '#0e0919'])

const SUN_X = 1150
const HORIZON = 640

type Look = {
  sky: string[]
  sunY: number
  sunScale: number
  sun: string
  halo: string
  glow: string
  glowOpacity: number
  lit: string
  shade: string
  far: string
  near: string
  ground: string
  cactus: string
  stars: number
}

// Todo lo que cambia con el momento del atardecer (t de 0 a 1).
function look(t: number): Look {
  const sky = [0, 1, 2, 3, 4].map(index =>
    color(
      SKY.map(key => ({ t: key.t, v: key.v[index]! })),
      t,
    ),
  )

  return {
    sky,
    sunY: r(180 + 480 * t),
    sunScale: r((58 + 30 * t) / 100),
    sun: color(SUN, t),
    halo: color(HALO, t),
    glow: color(GLOW, t),
    glowOpacity: r(0.2 + 0.42 * t),
    lit: color(CLOUD_LIT, t),
    shade: color(CLOUD_SHADE, t),
    far: color(FAR, t),
    near: color(NEAR, t),
    ground: color(GROUND, t),
    cactus: color(CACTUS, t),
    stars: r(num([{ t: 0.8, v: 0 }, { t: 0.98, v: 1 }], t)),
  }
}

// Nubes: altura, tamaño, segundos que tardan en cruzar, dónde van al empezar el
// día y qué tan opacas son. Lentas a propósito.
const CLOUDS = [
  { y: 110, s: 0.9, dur: 520, o: 0.1, a: 0.8 },
  { y: 205, s: 1.3, dur: 430, o: 0.55, a: 0.9 },
  { y: 300, s: 0.8, dur: 600, o: 0.8, a: 0.75 },
  { y: 385, s: 1.6, dur: 380, o: 0.3, a: 0.9 },
  { y: 470, s: 1.0, dur: 470, o: 0.65, a: 0.85 },
  { y: 160, s: 1.1, dur: 560, o: 0.92, a: 0.8 },
  { y: 545, s: 1.2, dur: 410, o: 0.18, a: 0.85 },
] as const

const CLOUD_X0 = -480
const CLOUD_X1 = 2080

const SHADE_PUFFS = [
  [0, 26, 200, 16],
  [-60, 10, 110, 22],
  [70, 12, 120, 22],
] as const

const LIT_PUFFS = [
  [-130, 8, 90, 24],
  [-55, -14, 100, 34],
  [40, -6, 110, 34],
  [125, 8, 86, 24],
  [0, 16, 190, 20],
] as const

// Aleatorio repetible, para que las estrellas no cambien de lugar al redibujar.
function seeded(seed: number): () => number {
  let a = seed

  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function starsMarkup(): string {
  const random = seeded(2611)
  let out = ''

  for (let i = 0; i < 54; i += 1) {
    const x = r(random() * W)
    const y = r(18 + random() * 400)
    const size = r(0.8 + random() * 1.5)
    out += `<circle class="s s${i % 6}" cx="${x}" cy="${y}" r="${size}" fill="#fff6e6" opacity="0.9"/>`
  }

  return out
}

function saguaro(x: number, y: number, s: number): string {
  const p = (dx: number, dy: number): string => `${r(x + dx * s)} ${r(y - dy * s)}`

  return (
    `<path d="M${p(0, 0)}L${p(0, 200)}" stroke-width="${r(28 * s)}"/>` +
    `<path d="M${p(0, 110)}L${p(-46, 110)}L${p(-46, 168)}" stroke-width="${r(17 * s)}"/>` +
    `<path d="M${p(0, 80)}L${p(44, 80)}L${p(44, 132)}" stroke-width="${r(16 * s)}"/>`
  )
}

export type SceneArgs = {
  from: number
  to: number
  elapsedMs: number
  nowMs: number
}

// El atardecer en el momento `to`; si el cambio desde `from` sigue en marcha, el
// cielo lo termina con CSS (para no saltar) y las nubes siguen el reloj.
export function buildScene({ from, to, elapsedMs, nowMs }: SceneArgs): string {
  const end = look(to)
  const start = look(from)
  const elapsedS = elapsedMs / 1000
  const isShifting = elapsedS >= 0 && elapsedS < SHIFT_S && Math.abs(to - from) > 0.003
  const showStars = end.stars > 0 || (isShifting && start.stars > 0)

  let css =
    '.s{animation:tw 6s ease-in-out infinite}' +
    '.s0{animation-duration:5.2s;animation-delay:-1.1s}' +
    '.s1{animation-duration:6.8s;animation-delay:-3.4s}' +
    '.s2{animation-duration:7.9s;animation-delay:-5.2s}' +
    '.s3{animation-duration:4.6s;animation-delay:-0.7s}' +
    '.s4{animation-duration:9.1s;animation-delay:-6.3s}' +
    '.s5{animation-duration:6.1s;animation-delay:-2.2s}' +
    '@keyframes tw{0%,100%{opacity:.4}50%{opacity:1}}'

  // Cambios suaves de un momento a otro: parten del valor anterior y llegan al
  // que está escrito en el propio SVG. Sin animación, el SVG ya es el final.
  const shift = (key: string, ids: string[], prop: string, value: string | number): void => {
    css +=
      `@keyframes ${key}{from{${prop}:${value}}}` +
      `${ids.map(id => `#${id}`).join(',')}{animation:${key} ${SHIFT_S}s cubic-bezier(.42,0,.58,1) ${r(-elapsedS)}s 1 both}`
  }

  let defs = ''
  const stops = ['0', '0.28', '0.52', '0.76', '1']
  defs += '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">'
  end.sky.forEach((c, i) => {
    defs += `<stop id="k${i}" offset="${stops[i]}" stop-color="${c}"/>`
  })
  defs += '</linearGradient>'
  defs +=
    `<radialGradient id="hl"><stop id="h0" offset="0" stop-color="${end.halo}" stop-opacity="0.85"/>` +
    `<stop id="h1" offset="0.3" stop-color="${end.halo}" stop-opacity="0.3"/>` +
    `<stop id="h2" offset="1" stop-color="${end.halo}" stop-opacity="0"/></radialGradient>`
  defs +=
    `<radialGradient id="gw"><stop id="g0" offset="0" stop-color="${end.glow}" stop-opacity="1"/>` +
    `<stop id="g1" offset="1" stop-color="${end.glow}" stop-opacity="0"/></radialGradient>`
  defs +=
    `<radialGradient id="la"><stop id="a0" offset="0" stop-color="${end.lit}" stop-opacity="0.95"/>` +
    `<stop id="a1" offset="1" stop-color="${end.lit}" stop-opacity="0"/></radialGradient>`
  defs +=
    `<radialGradient id="lb"><stop id="b0" offset="0" stop-color="${end.shade}" stop-opacity="0.9"/>` +
    `<stop id="b1" offset="1" stop-color="${end.shade}" stop-opacity="0"/></radialGradient>`

  // Casi todas las nubes pasan detrás del sol; dos finas pasan por delante.
  let cloudsBehind = ''
  let cloudsInFront = ''

  CLOUDS.forEach((cloud, index) => {
    const phase = (nowMs / 1000 / cloud.dur + cloud.o) % 1
    const x = r(CLOUD_X0 + (CLOUD_X1 - CLOUD_X0) * phase)
    const delay = r(-phase * cloud.dur)
    css +=
      `@keyframes d${index}{from{transform:translate(${CLOUD_X0}px,${cloud.y}px) scale(${cloud.s})}` +
      `to{transform:translate(${CLOUD_X1}px,${cloud.y}px) scale(${cloud.s})}}` +
      `#c${index}{animation:d${index} ${cloud.dur}s linear ${delay}s infinite}`
    let puffs = ''

    for (const [px, py, rx, ry] of SHADE_PUFFS) {
      puffs += `<ellipse cx="${px}" cy="${py}" rx="${rx}" ry="${ry}" fill="url(#lb)"/>`
    }

    for (const [px, py, rx, ry] of LIT_PUFFS) {
      puffs += `<ellipse cx="${px}" cy="${py}" rx="${rx}" ry="${ry}" fill="url(#la)"/>`
    }
    const group = `<g id="c${index}" transform="translate(${x} ${cloud.y}) scale(${cloud.s})" opacity="${cloud.a}">${puffs}</g>`

    if (index === 1 || index === 5) {
      cloudsInFront += group
    } else {
      cloudsBehind += group
    }
  })

  if (isShifting) {
    shift('ks', ['k0'], 'stop-color', start.sky[0]!)
    shift('k1s', ['k1'], 'stop-color', start.sky[1]!)
    shift('k2s', ['k2'], 'stop-color', start.sky[2]!)
    shift('k3s', ['k3'], 'stop-color', start.sky[3]!)
    shift('k4s', ['k4'], 'stop-color', start.sky[4]!)
    shift('hs', ['h0', 'h1', 'h2'], 'stop-color', start.halo)
    shift('gs', ['g0', 'g1'], 'stop-color', start.glow)
    shift('gos', ['gl'], 'opacity', start.glowOpacity)
    shift('las', ['a0', 'a1'], 'stop-color', start.lit)
    shift('lbs', ['b0', 'b1'], 'stop-color', start.shade)
    shift('sds', ['sd'], 'fill', start.sun)
    shift('mfs', ['mf'], 'fill', start.far)
    shift('mns', ['mn'], 'fill', start.near)
    shift('grs', ['gr'], 'fill', start.ground)
    shift('ccs', ['cc'], 'stroke', start.cactus)
    shift('sts', ['stars'], 'opacity', start.stars)
    css +=
      `@keyframes sus{from{transform:translate(${SUN_X}px,${start.sunY}px) scale(${start.sunScale})}` +
      `to{transform:translate(${SUN_X}px,${end.sunY}px) scale(${end.sunScale})}}` +
      `#sun{animation:sus ${SHIFT_S}s cubic-bezier(.42,0,.58,1) ${r(-elapsedS)}s 1 both}`
  }

  const body =
    `<rect width="${W}" height="720" fill="url(#sky)"/>` +
    `<g id="stars" opacity="${end.stars}">${showStars ? starsMarkup() : ''}</g>` +
    `<ellipse id="gl" cx="${SUN_X}" cy="${HORIZON}" rx="1000" ry="170" fill="url(#gw)" opacity="${end.glowOpacity}"/>` +
    cloudsBehind +
    `<g id="sun" transform="translate(${SUN_X} ${end.sunY}) scale(${end.sunScale})">` +
    `<circle r="520" fill="url(#hl)"/><circle id="sd" r="100" fill="${end.sun}"/></g>` +
    cloudsInFront +
    `<path id="mf" fill="${end.far}" d="M0,720L0,590L90,590L120,560L260,560L290,600L380,600L410,540L560,540L590,585L700,585L760,620L1000,640L1400,640L1440,600L1530,600L1560,570L1600,570L1600,720Z"/>` +
    `<path id="mn" fill="${end.near}" d="M0,740L0,655Q200,618 380,648T760,664T1150,676T1600,652L1600,740Z"/>` +
    `<rect id="gr" y="728" width="${W}" height="${H - 728}" fill="${end.ground}"/>` +
    `<g id="cc" fill="none" stroke="${end.cactus}" stroke-linecap="round" stroke-linejoin="round">` +
    saguaro(95, 790, 1.1) +
    saguaro(230, 762, 0.7) +
    saguaro(330, 748, 0.45) +
    saguaro(1470, 782, 1.0) +
    saguaro(1380, 754, 0.55) +
    '</g>'

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
    `<defs>${defs}</defs>` +
    `<style>${css}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>` +
    body +
    '</svg>'
  )
}
