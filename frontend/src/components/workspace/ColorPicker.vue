<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  cancel: []
  ok: []
}>()

const CANVAS_W = 220
const CANVAS_H = 152

const hue = ref(0)
const sat = ref(100)
const bri = ref(100)

const gradientCanvas = ref<HTMLCanvasElement | null>(null)
const hueSliderEl = ref<HTMLDivElement | null>(null)
const dotX = ref(0)
const dotY = ref(0)

const customColors = ref<string[]>([])

const simpleLightColors = [
  '#FFFFFF', '#F5F5F0', '#E8E4DF', '#D6CFC7', '#C4BAB0',
  '#FFF0F0', '#FFE4E4', '#FFDDD5', '#FFD0C0', '#FFC3A8',
]

const colorGrid = [
  '#CC0000','#FF0000','#FF6666','#FF9999','#FFCCCC',
  '#CC4400','#FF5500','#FF8855','#FFAA88','#FFCCBB',
  '#CC8800','#FFAA00','#FFCC44','#FFDD88','#FFEEBB',
  '#99AA00','#BBCC00','#CCDD33','#DDEE77','#EEFFBB',
  '#007700','#00AA00','#44CC44','#88EE88','#BBFFBB',
  '#007755','#00AA77','#33CC99','#77EEBB','#BBFFDD',
  '#006688','#0099CC','#33BBDD','#77DDEE','#BBEFF7',
  '#0033CC','#3366FF','#6699FF','#99BBFF','#CCDDFF',
  '#5500CC','#7733FF','#9966FF','#BBAAFF','#DDD0FF',
  '#880099','#BB00CC','#DD55DD','#EE99EE','#FFCCFF',
  '#000000','#333333','#555555','#888888','#AAAAAA',
  '#BBBBBB','#CCCCCC','#DDDDDD','#EEEEEE','#FFFFFF',
]

// ── Color math ──────────────────────────────────────────────────────────────

function hexToHsv(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  const s = max === 0 ? 0 : d / max
  const v = max
  if (max !== min) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: h * 360, s: s * 100, v: v * 100 }
}

function hsvToHex(h: number, s: number, v: number) {
  const hh = h / 360, ss = s / 100, vv = v / 100
  let r = 0, g = 0, b = 0
  const i = Math.floor(hh * 6)
  const f = hh * 6 - i
  const p = vv * (1 - ss), q = vv * (1 - f * ss), t = vv * (1 - (1 - f) * ss)
  switch (i % 6) {
    case 0: r = vv; g = t; b = p; break
    case 1: r = q; g = vv; b = p; break
    case 2: r = p; g = vv; b = t; break
    case 3: r = p; g = q; b = vv; break
    case 4: r = t; g = p; b = vv; break
    case 5: r = vv; g = p; b = q; break
  }
  return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

const currentHex = computed(() => hsvToHex(hue.value, sat.value, bri.value))
const currentRgb = computed(() => {
  const h = currentHex.value
  return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) }
})

const hexInput = ref('')
const rInput = ref(0)
const gInput = ref(0)
const bInput = ref(0)

watch(currentHex, v => { hexInput.value = v.slice(1).toUpperCase() }, { immediate: true })
watch(currentRgb, ({ r, g, b }) => { rInput.value = r; gInput.value = g; bInput.value = b }, { immediate: true })

// ── Canvas gradient ──────────────────────────────────────────────────────────

function drawGradient() {
  const canvas = gradientCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = `hsl(${hue.value}, 100%, 50%)`
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  const wg = ctx.createLinearGradient(0, 0, CANVAS_W, 0)
  wg.addColorStop(0, 'rgba(255,255,255,1)')
  wg.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = wg; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  bg.addColorStop(0, 'rgba(0,0,0,0)')
  bg.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
}

function syncDot() {
  dotX.value = (sat.value / 100) * CANVAS_W
  dotY.value = (1 - bri.value / 100) * CANVAS_H
}

watch(hue, drawGradient)

// ── Gradient canvas interaction ──────────────────────────────────────────────

function pickGradient(e: MouseEvent) {
  const rect = gradientCanvas.value!.getBoundingClientRect()
  const x = Math.max(0, Math.min(CANVAS_W, (e.clientX - rect.left) * (CANVAS_W / rect.width)))
  const y = Math.max(0, Math.min(CANVAS_H, (e.clientY - rect.top) * (CANVAS_H / rect.height)))
  sat.value = (x / CANVAS_W) * 100
  bri.value = (1 - y / CANVAS_H) * 100
  dotX.value = x; dotY.value = y
}

function onGradientMousedown(e: MouseEvent) {
  e.preventDefault()
  pickGradient(e)
  const mm = (e: MouseEvent) => pickGradient(e)
  const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu) }
  document.addEventListener('mousemove', mm)
  document.addEventListener('mouseup', mu)
}

// ── Hue slider interaction ───────────────────────────────────────────────────

function pickHue(e: MouseEvent) {
  const rect = hueSliderEl.value!.getBoundingClientRect()
  hue.value = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360))
}

function onHueMousedown(e: MouseEvent) {
  e.preventDefault()
  pickHue(e)
  const mm = (e: MouseEvent) => pickHue(e)
  const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu) }
  document.addEventListener('mousemove', mm)
  document.addEventListener('mouseup', mu)
}

// ── Inputs ───────────────────────────────────────────────────────────────────

function onHexInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
  hexInput.value = raw
  if (raw.length === 6) {
    const { h, s, v } = hexToHsv('#' + raw)
    hue.value = h; sat.value = s; bri.value = v
    nextTick(() => syncDot())
  }
}

function onRgbChange() {
  const r = Math.min(255, Math.max(0, rInput.value))
  const g = Math.min(255, Math.max(0, gInput.value))
  const b = Math.min(255, Math.max(0, bInput.value))
  const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
  const { h, s, v } = hexToHsv(hex)
  hue.value = h; sat.value = s; bri.value = v
  nextTick(() => syncDot())
}

// ── Init / preset selection ──────────────────────────────────────────────────

function applyHex(hex: string) {
  const clean = hex.startsWith('#') ? hex : '#' + hex
  if (!/^#[0-9a-fA-F]{6}$/.test(clean)) return
  const { h, s, v } = hexToHsv(clean)
  hue.value = h; sat.value = s; bri.value = v
}

function selectPreset(hex: string) {
  applyHex(hex)
  nextTick(() => { drawGradient(); syncDot() })
}

onMounted(() => {
  applyHex(props.modelValue)
  nextTick(() => { drawGradient(); syncDot() })
})

watch(() => props.modelValue, v => {
  applyHex(v)
  nextTick(() => { drawGradient(); syncDot() })
})

// ── Custom colors + eyedropper ───────────────────────────────────────────────

function addToCustom() {
  const c = currentHex.value
  if (!customColors.value.includes(c)) {
    customColors.value.unshift(c)
    if (customColors.value.length > 10) customColors.value.pop()
  }
}

async function useEyedropper() {
  if (!('EyeDropper' in window)) return
  try {
    const result = await (new (window as any).EyeDropper()).open()
    selectPreset(result.sRGBHex)
  } catch {}
}

// ── Actions ──────────────────────────────────────────────────────────────────

function onOk() {
  emit('update:modelValue', currentHex.value)
  emit('ok')
}

function onCancel() { emit('cancel') }
</script>

<template>
  <Teleport to="body">
    <div class="cp-backdrop" @mousedown.self="onCancel" />
    <div class="cp-picker">

      <!-- Left: swatches + grid -->
      <div class="cp-left">
        <p class="cp-section-title">Simple Light</p>
        <div class="cp-swatch-row">
          <button
            v-for="c in simpleLightColors" :key="c"
            class="cp-swatch"
            :class="{ 'cp-swatch--active': currentHex.toLowerCase() === c.toLowerCase() }"
            :style="{ background: c }"
            @click="selectPreset(c)"
          />
        </div>

        <div class="cp-custom-header">
          <p class="cp-section-title">Custom</p>
          <div class="cp-custom-actions">
            <button class="cp-icon-btn" title="Add current color" @click="addToCustom">
              <svg viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="cp-icon-btn" title="Eyedropper" @click="useEyedropper">
              <svg viewBox="0 0 14 14" fill="none">
                <path d="M10 2l2 2-1.5 1.5L9 4 4.5 8.5 3 10l-1 1-.5-.5 1-1 1.5-1.5L9 4l-1.5-1.5L9 1l1 1z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>
                <circle cx="3.5" cy="10.5" r="1" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="cp-custom-row">
          <button
            v-for="c in customColors" :key="c"
            class="cp-dot-btn"
            :class="{ 'cp-dot-btn--active': currentHex.toLowerCase() === c.toLowerCase() }"
            :style="{ background: c }"
            @click="selectPreset(c)"
          />
        </div>

        <div class="cp-grid">
          <button
            v-for="c in colorGrid" :key="c"
            class="cp-dot-btn"
            :class="{ 'cp-dot-btn--active': currentHex.toLowerCase() === c.toLowerCase() }"
            :style="{ background: c }"
            @click="selectPreset(c)"
          />
        </div>
      </div>

      <div class="cp-divider" />

      <!-- Right: gradient picker + controls -->
      <div class="cp-right">
        <div class="cp-gradient-wrap" @mousedown="onGradientMousedown">
          <canvas ref="gradientCanvas" :width="CANVAS_W" :height="CANVAS_H" class="cp-gradient-canvas" />
          <div class="cp-dot" :style="{ left: dotX + 'px', top: dotY + 'px' }" />
        </div>

        <div ref="hueSliderEl" class="cp-hue-slider" @mousedown="onHueMousedown">
          <div class="cp-hue-thumb" :style="{ left: (hue / 360 * 100) + '%' }" />
        </div>

        <div class="cp-preview-row">
          <div class="cp-preview" :style="{ background: currentHex }" />
          <div class="cp-hex-wrap">
            <span class="cp-hash">#</span>
            <input
              class="cp-hex-input"
              :value="hexInput"
              maxlength="6"
              spellcheck="false"
              @input="onHexInput"
            />
          </div>
        </div>

        <div class="cp-rgb-row">
          <div class="cp-channel">
            <input v-model.number="rInput" type="number" class="cp-channel-input" min="0" max="255" @change="onRgbChange" />
            <span class="cp-channel-label">R</span>
          </div>
          <div class="cp-channel">
            <input v-model.number="gInput" type="number" class="cp-channel-input" min="0" max="255" @change="onRgbChange" />
            <span class="cp-channel-label">G</span>
          </div>
          <div class="cp-channel">
            <input v-model.number="bInput" type="number" class="cp-channel-input" min="0" max="255" @change="onRgbChange" />
            <span class="cp-channel-label">B</span>
          </div>
        </div>

        <div class="cp-footer">
          <button class="cp-btn cp-btn--cancel" @click="onCancel">Cancel</button>
          <button class="cp-btn cp-btn--ok" @click="onOk">OK</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 998;
  background: transparent;
}

.cp-picker {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 999;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  padding: 20px;
  gap: 16px;
  user-select: none;
}

/* ── Left panel ─────────────────────────────────────────────── */
.cp-left {
  width: 190px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cp-section-title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  color: #5C6060;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.cp-swatch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.cp-swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
}

.cp-swatch:hover { border-color: #6b7280; }
.cp-swatch--active { border-color: #111827; }

.cp-custom-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cp-custom-actions {
  display: flex;
  gap: 4px;
}

.cp-icon-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #e6e6e6;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #374151;
  padding: 0;
}

.cp-icon-btn svg {
  width: 12px;
  height: 12px;
}

.cp-icon-btn:hover { background: #d0d0d0; }

.cp-custom-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-height: 8px;
}

.cp-dot-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
}

.cp-dot-btn:hover { border-color: #6b7280; }
.cp-dot-btn--active { border-color: #111827; }

.cp-grid {
  display: grid;
  grid-template-columns: repeat(5, 26px);
  gap: 5px;
}

/* ── Divider ────────────────────────────────────────────────── */
.cp-divider {
  width: 1px;
  background: #e6e6e6;
  align-self: stretch;
  margin: 0 2px;
}

/* ── Right panel ────────────────────────────────────────────── */
.cp-right {
  width: 244px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-gradient-wrap {
  position: relative;
  width: 220px;
  height: 152px;
  border-radius: 8px;
  overflow: hidden;
  cursor: crosshair;
  flex-shrink: 0;
}

.cp-gradient-canvas {
  display: block;
  width: 220px;
  height: 152px;
}

.cp-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.cp-hue-slider {
  position: relative;
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  cursor: pointer;
  flex-shrink: 0;
}

.cp-hue-thumb {
  position: absolute;
  top: 50%;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(0, 0, 0, 0.25);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.cp-preview-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cp-preview {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid #e6e6e6;
  flex-shrink: 0;
}

.cp-hex-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: #e6e6e6;
  border-radius: 16px;
  padding: 0 12px;
  height: 34px;
  gap: 4px;
}

.cp-hash {
  font-size: 13px;
  color: #6b7280;
  font-family: monospace;
  flex-shrink: 0;
}

.cp-hex-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  font-family: monospace;
  color: #111827;
  text-transform: uppercase;
}

.cp-rgb-row {
  display: flex;
  gap: 8px;
}

.cp-channel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.cp-channel-input {
  width: 100%;
  height: 32px;
  text-align: center;
  background: #e6e6e6;
  border: none;
  border-radius: 16px;
  outline: none;
  font-size: 12px;
  font-family: inherit;
  color: #111827;
  padding: 0;
}

.cp-channel-input::-webkit-inner-spin-button,
.cp-channel-input::-webkit-outer-spin-button { -webkit-appearance: none; }

.cp-channel-label {
  font-size: 11px;
  color: #5C6060;
  font-weight: 500;
}

.cp-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
}

.cp-btn {
  height: 36px;
  padding: 0 20px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
}

.cp-btn--cancel {
  background: #e6e6e6;
  color: #374151;
}

.cp-btn--cancel:hover { background: #d0d0d0; }

.cp-btn--ok {
  background: #7FEC8F;
  color: #000;
  box-shadow: 0 2px 8px rgba(127, 236, 143, 0.4);
}

.cp-btn--ok:hover { transform: translateY(-1px); }
</style>
