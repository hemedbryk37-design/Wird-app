import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync, inflateSync } from 'node:zlib'

const main = 'android/app/src/main'
const res = `${main}/res`

if (!existsSync(main)) {
  console.error('مجلد android غير موجود. نفّذ: pnpm cap:add')
  process.exit(1)
}

const SAMPLE_RATE = 22050

function alarmWav(seconds) {
  const total = SAMPLE_RATE * seconds
  const pcm = new Int16Array(total)
  const period = 1.6
  const beeps = 4
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE
    const local = t % period
    const slot = Math.floor(local / 0.25)
    const within = local - slot * 0.25
    if (slot >= beeps || within > 0.18) continue
    const freq = slot % 2 === 0 ? 988 : 1319
    const env = Math.min(1, within / 0.008, (0.18 - within) / 0.012)
    const phase = 2 * Math.PI * freq * t
    const wave = Math.sin(phase) + 0.35 * Math.sin(3 * phase) + 0.15 * Math.sin(5 * phase)
    pcm[i] = Math.round(Math.max(-1, Math.min(1, (wave / 1.5) * env * 1.1)) * 0.9 * 32767)
  }
  const data = Buffer.from(pcm.buffer)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const raw = `${res}/raw`
mkdirSync(raw, { recursive: true })
if (existsSync('android-assets/raw')) {
  for (const file of readdirSync('android-assets/raw')) cpSync(`android-assets/raw/${file}`, `${raw}/${file}`)
}
writeFileSync(`${raw}/wird_alarm.wav`, alarmWav(24))

const manifestPath = `${main}/AndroidManifest.xml`
let manifest = readFileSync(manifestPath, 'utf8')
const permissions = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.WAKE_LOCK',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
]
const missing = permissions.filter((p) => !manifest.includes(`"${p}"`))
if (missing.length) {
  const lines = missing.map((p) => `    <uses-permission android:name="${p}" />`).join('\n')
  manifest = manifest.replace('</manifest>', `${lines}\n</manifest>`)
  writeFileSync(manifestPath, manifest)
}

const gradlePath = 'android/app/build.gradle'
if (existsSync(gradlePath) && existsSync('android-assets/wird.keystore')) {
  cpSync('android-assets/wird.keystore', 'android/app/wird.keystore')
  let gradle = readFileSync(gradlePath, 'utf8')
  gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode 2').replace(/versionName\s+"[^"]*"/, 'versionName "3.2"')
  if (!gradle.includes('signingConfigs.wird')) {
    const signing = [
      '    signingConfigs {',
      '        wird {',
      '            storeFile file("wird.keystore")',
      '            storePassword "wird1234"',
      '            keyAlias "wird"',
      '            keyPassword "wird1234"',
      '        }',
      '    }',
      '',
    ].join('\n')
    gradle = gradle.replace(/^(\s*)buildTypes\s*\{/m, `${signing}$1buildTypes {\n$1    debug {\n$1        signingConfig signingConfigs.wird\n$1    }`)
    gradle = gradle.replace(/(\n\s*release\s*\{)/, '$1\n            signingConfig signingConfigs.wird')
  }
  writeFileSync(gradlePath, gradle)
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

function encodePng(w, h, rgba) {
  const stride = w * 4 + 1
  const rows = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    rows[y * stride] = 0
    rgba.copy(rows, y * stride + 1, y * w * 4, (y + 1) * w * 4)
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(w, 0)
  head.writeUInt32BE(h, 4)
  head[8] = 8
  head[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function decodePng(buf) {
  let pos = 8
  let w = 0
  let h = 0
  let depth = 0
  let type = 0
  let palette = null
  let trns = null
  const parts = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const name = buf.toString('latin1', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (name === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      depth = data[8]
      type = data[9]
      if (data[12] !== 0) throw new Error('PNG interlaced غير مدعوم')
    } else if (name === 'PLTE') palette = data
    else if (name === 'tRNS') trns = data
    else if (name === 'IDAT') parts.push(data)
    pos += len + 12
  }
  if (depth !== 8) throw new Error('عمق PNG غير مدعوم')
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]
  if (!channels) throw new Error('نوع PNG غير مدعوم')
  const raw = inflateSync(Buffer.concat(parts))
  const stride = w * channels
  const pixels = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * (stride + 1) + 1 + x]
      const a = x >= channels ? pixels[y * stride + x - channels] : 0
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0
      let v
      if (filter === 0) v = cur
      else if (filter === 1) v = cur + a
      else if (filter === 2) v = cur + b
      else if (filter === 3) v = cur + ((a + b) >> 1)
      else {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
      pixels[y * stride + x] = v & 0xff
    }
  }
  const rgba = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    let r
    let g
    let b
    let a = 255
    if (type === 6) [r, g, b, a] = [pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2], pixels[i * 4 + 3]]
    else if (type === 2) [r, g, b] = [pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]]
    else if (type === 0) r = g = b = pixels[i]
    else if (type === 4) {
      r = g = b = pixels[i * 2]
      a = pixels[i * 2 + 1]
    } else {
      const idx = pixels[i]
      ;[r, g, b] = [palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2]]
      a = trns && idx < trns.length ? trns[idx] : 255
    }
    rgba[i * 4] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = a
  }
  return { w, h, data: rgba }
}

function resize(img, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4)
  const sx = img.w / dw
  const sy = img.h / dh
  const px = (x, y) => {
    const cx = Math.min(img.w - 1, Math.max(0, x))
    const cy = Math.min(img.h - 1, Math.max(0, y))
    const i = (cy * img.w + cx) * 4
    const a = img.data[i + 3] / 255
    return [img.data[i] * a, img.data[i + 1] * a, img.data[i + 2] * a, a]
  }
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      let acc = [0, 0, 0, 0]
      if (sx > 1 || sy > 1) {
        const x0 = x * sx
        const x1 = (x + 1) * sx
        const y0 = y * sy
        const y1 = (y + 1) * sy
        let weight = 0
        for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
          const wy = Math.min(yy + 1, y1) - Math.max(yy, y0)
          for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
            const wx = Math.min(xx + 1, x1) - Math.max(xx, x0)
            const p = px(xx, yy)
            const wgt = wx * wy
            for (let k = 0; k < 4; k++) acc[k] += p[k] * wgt
            weight += wgt
          }
        }
        acc = acc.map((v) => v / weight)
      } else {
        const fx = (x + 0.5) * sx - 0.5
        const fy = (y + 0.5) * sy - 0.5
        const ix = Math.floor(fx)
        const iy = Math.floor(fy)
        const tx = fx - ix
        const ty = fy - iy
        const p00 = px(ix, iy)
        const p10 = px(ix + 1, iy)
        const p01 = px(ix, iy + 1)
        const p11 = px(ix + 1, iy + 1)
        for (let k = 0; k < 4; k++) {
          acc[k] = p00[k] * (1 - tx) * (1 - ty) + p10[k] * tx * (1 - ty) + p01[k] * (1 - tx) * ty + p11[k] * tx * ty
        }
      }
      const i = (y * dw + x) * 4
      const a = acc[3]
      if (a > 0) {
        out[i] = Math.round(acc[0] / a)
        out[i + 1] = Math.round(acc[1] / a)
        out[i + 2] = Math.round(acc[2] / a)
        out[i + 3] = Math.round(a * 255)
      }
    }
  }
  return { w: dw, h: dh, data: out }
}

function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++) {
    const ty = y + oy
    if (ty < 0 || ty >= dst.h) continue
    for (let x = 0; x < src.w; x++) {
      const tx = x + ox
      if (tx < 0 || tx >= dst.w) continue
      const s = (y * src.w + x) * 4
      const d = (ty * dst.w + tx) * 4
      const sa = src.data[s + 3] / 255
      const da = dst.data[d + 3] / 255
      const oa = sa + da * (1 - sa)
      if (oa === 0) continue
      for (let k = 0; k < 3; k++) {
        dst.data[d + k] = Math.round((src.data[s + k] * sa + dst.data[d + k] * da * (1 - sa)) / oa)
      }
      dst.data[d + 3] = Math.round(oa * 255)
    }
  }
}

const canvas = (w, h, color) => {
  const data = Buffer.alloc(w * h * 4)
  if (color) {
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = color[0]
      data[i * 4 + 1] = color[1]
      data[i * 4 + 2] = color[2]
      data[i * 4 + 3] = 255
    }
  }
  return { w, h, data }
}

function circleMask(img) {
  const r = img.w / 2
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const dist = Math.hypot(x + 0.5 - r, y + 0.5 - r)
      const cover = Math.min(1, Math.max(0, r - dist + 0.5))
      const i = (y * img.w + x) * 4 + 3
      img.data[i] = Math.round(img.data[i] * cover)
    }
  }
  return img
}

const SOURCE = 'public/icon-512.png'
if (!existsSync(SOURCE)) {
  console.error(`ملف الشعار غير موجود: ${SOURCE}`)
  process.exit(1)
}
const logo = decodePng(readFileSync(SOURCE))
const logoFull = { ...logo, data: Buffer.from(logo.data) }

function roundedMask(img, radius, inset) {
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const dx = Math.max(radius - (x + 0.5), 0, x + 0.5 - (img.w - radius))
      const dy = Math.max(radius - (y + 0.5), 0, y + 0.5 - (img.h - radius))
      const edge = Math.min(x + 0.5, y + 0.5, img.w - x - 0.5, img.h - y - 0.5)
      const dist = dx > 0 && dy > 0 ? radius - Math.hypot(dx, dy) : edge
      const cover = Math.min(1, Math.max(0, dist - inset + 0.5))
      const i = (y * img.w + x) * 4 + 3
      img.data[i] = Math.round(img.data[i] * cover)
    }
  }
}

roundedMask(logo, logo.w * 0.195, 2)
const greenAt = (x, y) => {
  const i = (y * logo.w + x) * 4
  return [logo.data[i], logo.data[i + 1], logo.data[i + 2]]
}
const GREEN = greenAt(Math.round(logo.w * 0.5), Math.round(logo.h * 0.12))
const hex = GREEN.map((v) => v.toString(16).padStart(2, '0')).join('')

const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
const ADAPTIVE = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }
const write = (path, img) => writeFileSync(path, encodePng(img.w, img.h, img.data))

for (const density of Object.keys(LEGACY)) {
  const dir = `${res}/mipmap-${density}`
  mkdirSync(dir, { recursive: true })
  const size = LEGACY[density]
  write(`${dir}/ic_launcher.png`, resize(logo, size, size))
  write(`${dir}/ic_launcher_round.png`, circleMask(resize(logoFull, size, size)))
  const full = ADAPTIVE[density]
  const layer = canvas(full, full)
  const inner = Math.round(full * 0.8)
  blit(layer, resize(logo, inner, inner), Math.round((full - inner) / 2), Math.round((full - inner) / 2))
  write(`${dir}/ic_launcher_foreground.png`, layer)
}

mkdirSync(`${res}/values`, { recursive: true })
writeFileSync(
  `${res}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#${hex}</color>\n</resources>\n`,
)

function findFiles(dir, name, found = []) {
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) findFiles(path, name, found)
    else if (entry === name) found.push(path)
  }
  return found
}

for (const file of findFiles(res, 'splash.png')) {
  const head = readFileSync(file)
  const w = head.readUInt32BE(16)
  const h = head.readUInt32BE(20)
  if (!(w > 0 && h > 0)) continue
  const splash = canvas(w, h, GREEN)
  const size = Math.round(Math.min(w, h) * 0.34)
  blit(splash, resize(logo, size, size), Math.round((w - size) / 2), Math.round((h - size) / 2))
  write(file, splash)
}

console.log('تم نسخ نغمات المنبه وتوليد wird_alarm.wav، وضبط الصلاحيات، واستبدال الأيقونات بشعار التطبيق.')
