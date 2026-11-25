import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'

const app = 'android/app/src/main'
if (!existsSync(app)) {
  console.error('مجلد android غير موجود. نفّذ: pnpm cap:add')
  process.exit(1)
}

const raw = `${app}/res/raw`
mkdirSync(raw, { recursive: true })
for (const file of readdirSync('android-assets/raw')) cpSync(`android-assets/raw/${file}`, `${raw}/${file}`)

const manifestPath = `${app}/AndroidManifest.xml`
let manifest = readFileSync(manifestPath, 'utf8')
const permissions = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
]
const missing = permissions.filter((p) => !manifest.includes(`"${p}"`))
if (missing.length) {
  const lines = missing.map((p) => `    <uses-permission android:name="${p}" />`).join('\n')
  manifest = manifest.replace('</manifest>', `${lines}\n</manifest>`)
  writeFileSync(manifestPath, manifest)
}

console.log('تم نسخ نغمات المنبه وضبط صلاحيات أندرويد.')
