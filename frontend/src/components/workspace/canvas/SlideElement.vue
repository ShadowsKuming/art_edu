<script setup lang="ts">
import { ref, computed, inject, onMounted, watch, nextTick } from 'vue'
import type { Ref } from 'vue'
import { CANVAS_W, CANVAS_H, useSlideStore } from '@/stores/slides'
import type { SlideElement } from '@/stores/slides'

const props = defineProps<{
  element: SlideElement
  selected: boolean
}>()

const emit = defineEmits<{
  select: []
  update: [patch: Partial<SlideElement>]
  delete: []
}>()

const slideStore = useSlideStore()
const canvasEl = inject<Ref<HTMLElement | null>>('canvasEl')
const editing  = ref(false)
const cropping = ref(false)
const textEl   = ref<HTMLElement | null>(null)
const elRef    = ref<HTMLElement | null>(null)

const HANDLES = [
  { id: 'tl', xDir: -1, yDir: -1 },
  { id: 'tr', xDir:  1, yDir: -1 },
  { id: 'bl', xDir: -1, yDir:  1 },
  { id: 'br', xDir:  1, yDir:  1 },
] as const

onMounted(() => {
  if (props.element.type === 'text' && textEl.value)
    textEl.value.innerText = props.element.content
})

watch(() => props.element.content, (val) => {
  if (props.element.type === 'text' && !editing.value && textEl.value)
    textEl.value.innerText = val
})

watch(() => props.selected, (val) => {
  if (!val) cropping.value = false
})

// ── Helpers ───────────────────────────────────────────────────────────────

function getScale(): number {
  return (canvasEl?.value?.clientWidth ?? CANVAS_W) / CANVAS_W
}

// ── Computed styles ───────────────────────────────────────────────────────

const elementStyle = computed(() => ({
  left:      (props.element.x / CANVAS_W * 100) + '%',
  top:       (props.element.y / CANVAS_H * 100) + '%',
  width:     (props.element.width  / CANVAS_W * 100) + '%',
  height:    (props.element.height / CANVAS_H * 100) + '%',
  transform: props.element.rotation ? `rotate(${props.element.rotation}deg)` : undefined,
}))

const imgStyle = computed(() => {
  const sx = props.element.flipH ? -1 : 1
  const sy = props.element.flipV ? -1 : 1
  const t  = props.element.cropT ?? 0
  const r  = props.element.cropR ?? 0
  const b  = props.element.cropB ?? 0
  const l  = props.element.cropL ?? 0
  return {
    transform: (sx !== 1 || sy !== 1) ? `scale(${sx}, ${sy})` : undefined,
    clipPath:  (t || r || b || l) ? `inset(${t*100}% ${r*100}% ${b*100}% ${l*100}%)` : undefined,
  }
})

// ── Crop handles ──────────────────────────────────────────────────────────

const cropHandles = computed(() => {
  const t  = (props.element.cropT ?? 0) * 100
  const rp = (1 - (props.element.cropR ?? 0)) * 100
  const b  = (1 - (props.element.cropB ?? 0)) * 100
  const l  = (props.element.cropL ?? 0) * 100
  const mx = (l + rp) / 2
  const my = (t + b) / 2
  return [
    { id: 'tl', x: l,  y: t,  xEdge: -1, yEdge: -1, cursor: 'nw-resize' },
    { id: 'tc', x: mx, y: t,  xEdge:  0, yEdge: -1, cursor: 'n-resize'  },
    { id: 'tr', x: rp, y: t,  xEdge:  1, yEdge: -1, cursor: 'ne-resize' },
    { id: 'ml', x: l,  y: my, xEdge: -1, yEdge:  0, cursor: 'w-resize'  },
    { id: 'mr', x: rp, y: my, xEdge:  1, yEdge:  0, cursor: 'e-resize'  },
    { id: 'bl', x: l,  y: b,  xEdge: -1, yEdge:  1, cursor: 'sw-resize' },
    { id: 'bc', x: mx, y: b,  xEdge:  0, yEdge:  1, cursor: 's-resize'  },
    { id: 'br', x: rp, y: b,  xEdge:  1, yEdge:  1, cursor: 'se-resize' },
  ]
})

// ── Drag ──────────────────────────────────────────────────────────────────

function onDragStart(e: MouseEvent) {
  if (editing.value || cropping.value) return
  e.stopPropagation()
  emit('select')
  slideStore.checkpoint()

  const scale  = getScale()
  const startX = e.clientX
  const startY = e.clientY
  const ox = props.element.x
  const oy = props.element.y

  function onMove(e: MouseEvent) {
    const nx = ox + (e.clientX - startX) / scale
    const ny = oy + (e.clientY - startY) / scale
    emit('update', {
      x: Math.max(0, Math.min(CANVAS_W - props.element.width, nx)),
      y: Math.max(0, Math.min(CANVAS_H - props.element.height, ny)),
    })
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── Resize ────────────────────────────────────────────────────────────────

function onResizeStart(e: MouseEvent, handle: typeof HANDLES[number]) {
  e.stopPropagation()
  e.preventDefault()
  slideStore.checkpoint()

  const scale  = getScale()
  const startX = e.clientX
  const startY = e.clientY
  const { x, y, width, height } = props.element
  const rotRad = ((props.element.rotation ?? 0) * Math.PI) / 180

  function onMove(e: MouseEvent) {
    const sdx = (e.clientX - startX) / scale
    const sdy = (e.clientY - startY) / scale
    // rotate screen-space delta into element-local space
    const ldx = (sdx * Math.cos(rotRad) + sdy * Math.sin(rotRad)) * handle.xDir
    const ldy = (-sdx * Math.sin(rotRad) + sdy * Math.cos(rotRad)) * handle.yDir

    const newW = Math.max(60, width + ldx)
    const newH = Math.max(32, height + ldy)
    const newX = handle.xDir === -1 ? x - (newW - width) : x
    const newY = handle.yDir === -1 ? y - (newH - height) : y
    emit('update', { x: newX, y: newY, width: newW, height: newH })
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── Rotate ────────────────────────────────────────────────────────────────

function onRotateStart(e: MouseEvent) {
  e.stopPropagation()
  e.preventDefault()
  slideStore.checkpoint()

  const rect = elRef.value!.getBoundingClientRect()
  const cx = rect.left + rect.width  / 2
  const cy = rect.top  + rect.height / 2
  const startAngle  = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)
  const startRotation = props.element.rotation ?? 0

  function onMove(e: MouseEvent) {
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)
    emit('update', { rotation: startRotation + angle - startAngle })
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── Crop ──────────────────────────────────────────────────────────────────

function onCropHandleStart(e: MouseEvent, handle: { xEdge: number; yEdge: number }) {
  e.stopPropagation()
  e.preventDefault()
  slideStore.checkpoint()

  const scale  = getScale()
  const startX = e.clientX
  const startY = e.clientY
  const { width, height } = props.element
  const rotRad = ((props.element.rotation ?? 0) * Math.PI) / 180
  const ct = props.element.cropT ?? 0
  const cr = props.element.cropR ?? 0
  const cb = props.element.cropB ?? 0
  const cl = props.element.cropL ?? 0

  function onMove(e: MouseEvent) {
    const sdx = (e.clientX - startX) / scale
    const sdy = (e.clientY - startY) / scale
    // transform to element-local space, then to fractions
    const dx = (sdx * Math.cos(rotRad) + sdy * Math.sin(rotRad)) / width
    const dy = (-sdx * Math.sin(rotRad) + sdy * Math.cos(rotRad)) / height
    const patch: Partial<SlideElement> = {}
    if (handle.xEdge === -1) patch.cropL = Math.max(0, Math.min(1 - cr - 0.05, cl + dx))
    if (handle.xEdge ===  1) patch.cropR = Math.max(0, Math.min(1 - cl - 0.05, cr - dx))
    if (handle.yEdge === -1) patch.cropT = Math.max(0, Math.min(1 - cb - 0.05, ct + dy))
    if (handle.yEdge ===  1) patch.cropB = Math.max(0, Math.min(1 - ct - 0.05, cb - dy))
    emit('update', patch)
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── Text edit ─────────────────────────────────────────────────────────────

function startEdit(e: MouseEvent) {
  e.stopPropagation()
  slideStore.checkpoint()
  editing.value = true
  nextTick(() => {
    textEl.value?.focus()
    const range = document.createRange()
    range.selectNodeContents(textEl.value!)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
  })
}

function commitEdit() {
  if (!editing.value) return
  editing.value = false
  emit('update', { content: textEl.value?.innerText ?? '' })
}
</script>

<template>
  <div
    ref="elRef"
    class="slide-element"
    :class="{ 'slide-element--selected': selected }"
    :style="elementStyle"
    @mousedown.left="onDragStart"
    @click.stop="emit('select')"
  >
    <!-- Image -->
    <img
      v-if="element.type === 'image'"
      :src="element.src"
      class="img-content"
      :style="imgStyle"
      draggable="false"
    />

    <!-- Text -->
    <div
      v-else
      ref="textEl"
      class="text-content"
      :class="{ 'text-content--editing': editing }"
      :contenteditable="editing"
      :style="{
        fontSize:   (element.fontSize / CANVAS_W * 100) + 'cqw',
        fontWeight: element.fontWeight === 'Bold' ? '700' : element.fontWeight === 'Medium' ? '500' : '400',
        fontFamily: element.fontFamily,
        textAlign:  element.textAlign,
        color:      element.color,
      }"
      @dblclick="startEdit"
      @blur="commitEdit"
      @keydown.escape.prevent="commitEdit"
      @keydown.enter.exact.prevent="commitEdit"
    />

    <!-- Crop overlay -->
    <template v-if="cropping && element.type === 'image'">
      <div class="crop-shade crop-shade--top"    :style="{ height: (element.cropT ?? 0) * 100 + '%' }" />
      <div class="crop-shade crop-shade--bottom" :style="{ height: (element.cropB ?? 0) * 100 + '%' }" />
      <div class="crop-shade crop-shade--left"   :style="{
        top:    (element.cropT ?? 0) * 100 + '%',
        bottom: (element.cropB ?? 0) * 100 + '%',
        width:  (element.cropL ?? 0) * 100 + '%',
      }" />
      <div class="crop-shade crop-shade--right"  :style="{
        top:    (element.cropT ?? 0) * 100 + '%',
        bottom: (element.cropB ?? 0) * 100 + '%',
        width:  (element.cropR ?? 0) * 100 + '%',
      }" />
      <!-- Crop rect border -->
      <div class="crop-rect" :style="{
        top:    (element.cropT ?? 0) * 100 + '%',
        right:  (element.cropR ?? 0) * 100 + '%',
        bottom: (element.cropB ?? 0) * 100 + '%',
        left:   (element.cropL ?? 0) * 100 + '%',
      }" />
      <!-- 8 crop handles -->
      <div
        v-for="h in cropHandles"
        :key="h.id"
        class="crop-handle"
        :style="{ left: h.x + '%', top: h.y + '%', cursor: h.cursor }"
        @mousedown.left.stop="onCropHandleStart($event, h)"
      />
      <button class="crop-done-btn" @click.stop="cropping = false">Done</button>
    </template>

    <!-- Selection controls -->
    <template v-if="selected && !editing && !cropping">
      <!-- Rotate handle -->
      <div class="rotate-handle" @mousedown.left.stop="onRotateStart">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M13.5 8A5.5 5.5 0 112.5 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M13.5 4v4h-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <!-- Resize handles -->
      <div
        v-for="h in HANDLES"
        :key="h.id"
        class="resize-handle"
        :class="`resize-handle--${h.id}`"
        @mousedown.left.stop="onResizeStart($event, h)"
      />

      <!-- Crop button (image only) -->
      <button v-if="element.type === 'image'" class="crop-btn" title="Crop" @click.stop="cropping = true">
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M5 1v12a2 2 0 002 2h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M1 5h12a2 2 0 012 2v12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- Delete button -->
      <button class="delete-btn" @click.stop="emit('delete')">✕</button>
    </template>
  </div>
</template>

<style scoped>
.slide-element {
  position: absolute;
  cursor: move;
  box-sizing: border-box;
  border: 1.5px solid transparent;
  border-radius: 4px;
  user-select: none;
  z-index: 1;
}

.slide-element--selected { border-color: #6366f1; }

.slide-element:hover:not(.slide-element--selected) { border-color: #c7d2fe; }

/* ── Content ──────────────────────────────────────────────────────────────── */

.img-content {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
  user-select: none;
}

.text-content {
  width: 100%;
  height: 100%;
  overflow: hidden;
  line-height: 1.4;
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
  container-type: inline-size;
}

.text-content--editing {
  cursor: text;
  user-select: text;
  overflow: auto;
}

/* ── Rotate handle ────────────────────────────────────────────────────────── */

.rotate-handle {
  position: absolute;
  top: -34px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  background: #fff;
  border: 1.5px solid #6366f1;
  border-radius: 50%;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 12;
  color: #6366f1;
  padding: 3px;
}

.rotate-handle::after {
  content: '';
  position: absolute;
  bottom: -14px;
  left: 50%;
  transform: translateX(-50%);
  width: 1.5px;
  height: 13px;
  background: #6366f1;
  pointer-events: none;
}

/* ── Resize handles ───────────────────────────────────────────────────────── */

.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 1.5px solid #6366f1;
  border-radius: 2px;
  z-index: 10;
}

.resize-handle--tl { top: 2px;    left: 2px;   cursor: nw-resize; }
.resize-handle--tr { top: 2px;    right: 2px;  cursor: ne-resize; }
.resize-handle--bl { bottom: 2px; left: 2px;   cursor: sw-resize; }
.resize-handle--br { bottom: 2px; right: 2px;  cursor: se-resize; }

/* ── Crop button ──────────────────────────────────────────────────────────── */

.crop-btn {
  position: absolute;
  top: -11px;
  left: -11px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11;
  padding: 3px;
}

/* ── Delete button ────────────────────────────────────────────────────────── */

.delete-btn {
  position: absolute;
  top: -11px;
  right: -11px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  border: none;
  font-size: 9px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11;
  padding: 0;
}

/* ── Crop overlay ─────────────────────────────────────────────────────────── */

.crop-shade {
  position: absolute;
  background: rgba(0, 0, 0, 0.45);
  z-index: 5;
  pointer-events: none;
}

.crop-shade--top    { top: 0;    left: 0; right: 0; }
.crop-shade--bottom { bottom: 0; left: 0; right: 0; }
.crop-shade--left   { left: 0; }
.crop-shade--right  { right: 0; }

.crop-rect {
  position: absolute;
  border: 1.5px solid rgba(255, 255, 255, 0.8);
  z-index: 6;
  pointer-events: none;
}

.crop-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 1.5px solid #6366f1;
  border-radius: 2px;
  transform: translate(-50%, -50%);
  z-index: 7;
}

.crop-done-btn {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 3px 10px;
  font-size: 11px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  z-index: 8;
}
</style>
