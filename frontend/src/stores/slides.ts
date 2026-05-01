import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const CANVAS_W = 960
export const CANVAS_H = 540

export type ElementType = 'text' | 'image'

export interface SlideElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  // text
  content: string
  fontSize: number
  fontWeight: string
  fontFamily: string
  textAlign: 'left' | 'center' | 'right' | 'justify'
  color: string
  // image
  src?: string
  flipH?: boolean
  flipV?: boolean
  rotation?: number
  cropT?: number
  cropR?: number
  cropB?: number
  cropL?: number
}

export interface Slide {
  id: string
  partId: number
  elements: SlideElement[]
  background?: string    // image data URL
  bgColor?: string       // solid color
  isLocalBackground?: boolean  // true = teacher override, false/undefined = follows global theme
}

let elCounter = 0

export const useSlideStore = defineStore('slides', () => {
  const slides = ref<Slide[]>([])
  const activeSlideId = ref<string | null>(null)
  const selectedElementId = ref<string | null>(null)
  const activePart = ref<number>(1)
  const maxUnlockedPart = ref<number>(1)

  // Global theme — set implicitly by Part 1 background changes
  const globalBackground = ref<string | undefined>(undefined)
  const globalBgColor = ref<string | undefined>(undefined)

  const activeSlide = computed(() =>
    slides.value.find(s => s.id === activeSlideId.value) ?? null
  )

  const selectedElement = computed(() =>
    activeSlide.value?.elements.find(e => e.id === selectedElementId.value) ?? null
  )

  function slidesForPart(partId: number) {
    return slides.value.filter(s => s.partId === partId)
  }

  function addSlide(partId: number): string {
    const id = `slide-${Date.now()}`
    slides.value.push({
      id, partId, elements: [],
      background: globalBackground.value,
      bgColor: globalBgColor.value,
      isLocalBackground: false,
    })
    activeSlideId.value = id
    selectedElementId.value = null
    return id
  }

  function selectSlide(id: string) {
    activeSlideId.value = id
    selectedElementId.value = null
  }

  function addElement(slideId: string, type: ElementType) {
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    const id = `el-${++elCounter}`
    slide.elements.push({
      id, type,
      x: CANVAS_W / 2 - 150,
      y: CANVAS_H / 2 - 40,
      width: 300,
      height: 80,
      content: 'Double-click to edit',
      fontSize: 24,
      fontWeight: 'Normal',
      fontFamily: 'Albert Sans',
      textAlign: 'left',
      color: '#111827',
    })
    selectedElementId.value = id
  }

  function addImageElement(slideId: string, src: string, width: number, height: number) {
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    const id = `el-${++elCounter}`
    slide.elements.push({
      id, type: 'image', src,
      x: Math.round((CANVAS_W - width) / 2),
      y: Math.round((CANVAS_H - height) / 2),
      width, height,
      content: '', fontSize: 24, fontWeight: 'Normal',
      fontFamily: 'Albert Sans', textAlign: 'left', color: '#111827',
    })
    selectedElementId.value = id
  }

  function updateElement(slideId: string, id: string, patch: Partial<SlideElement>) {
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    const el = slide.elements.find(e => e.id === id)
    if (el) Object.assign(el, patch)
  }

  function removeElement(slideId: string, id: string) {
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    slide.elements = slide.elements.filter(e => e.id !== id)
    if (selectedElementId.value === id) selectedElementId.value = null
  }

  function selectElement(id: string | null) {
    selectedElementId.value = id
  }

  function _propagateGlobal() {
    slides.value.forEach(s => {
      if (!s.isLocalBackground) {
        s.background = globalBackground.value
        s.bgColor = globalBgColor.value
      }
    })
  }

  function setSlideBackground(slideId: string, bg: string) {
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    if (slide.partId === 1) {
      globalBackground.value = bg
      globalBgColor.value = undefined
      slide.background = bg
      slide.bgColor = undefined
      slide.isLocalBackground = false
      _propagateGlobal()
    } else {
      slide.isLocalBackground = true
      slide.background = bg
      slide.bgColor = undefined
    }
  }

  function setSlideBgColor(slideId: string, color: string) {
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    if (slide.partId === 1) {
      globalBgColor.value = color
      globalBackground.value = undefined
      slide.bgColor = color
      slide.background = undefined
      slide.isLocalBackground = false
      _propagateGlobal()
    } else {
      slide.isLocalBackground = true
      slide.bgColor = color
      slide.background = undefined
    }
  }

  function resetSlideToGlobal(slideId: string) {
    const slide = slides.value.find(s => s.id === slideId)
    if (!slide) return
    slide.isLocalBackground = false
    slide.background = globalBackground.value
    slide.bgColor = globalBgColor.value
  }

  function navigateToNextPart() {
    const next = activePart.value + 1
    if (next > 7) return
    activePart.value = next
    if (next > maxUnlockedPart.value) maxUnlockedPart.value = next
  }

  function navigateToPart(partId: number) {
    if (partId >= 1 && partId <= maxUnlockedPart.value) {
      activePart.value = partId
    }
  }

  function getSnapshot() {
    return {
      slides: JSON.parse(JSON.stringify(slides.value)) as Slide[],
      activePart: activePart.value,
      maxUnlockedPart: maxUnlockedPart.value,
      globalBackground: globalBackground.value,
      globalBgColor: globalBgColor.value,
    }
  }

  function loadSnapshot(snap: ReturnType<typeof getSnapshot>) {
    slides.value = snap.slides
    activePart.value = snap.activePart
    maxUnlockedPart.value = snap.maxUnlockedPart
    globalBackground.value = snap.globalBackground
    globalBgColor.value = snap.globalBgColor
    activeSlideId.value = snap.slides[0]?.id ?? null
    selectedElementId.value = null
  }

  function removeSlide(slideId: string) {
    const idx = slides.value.findIndex(s => s.id === slideId)
    if (idx === -1) return
    const partId = slides.value[idx].partId
    const partSlides = slides.value.filter(s => s.partId === partId)
    if (partSlides.length <= 1) return  // keep at least one
    slides.value.splice(idx, 1)
    if (activeSlideId.value === slideId) {
      const remaining = slides.value.filter(s => s.partId === partId)
      activeSlideId.value = remaining[Math.min(idx, remaining.length - 1)]?.id ?? null
      selectedElementId.value = null
    }
  }

  function reset() {
    slides.value = []
    activeSlideId.value = null
    selectedElementId.value = null
    activePart.value = 1
    maxUnlockedPart.value = 1
    globalBackground.value = undefined
    globalBgColor.value = undefined
  }

  return {
    slides, activeSlideId, selectedElementId, activePart, maxUnlockedPart,
    globalBackground, globalBgColor,
    activeSlide, selectedElement,
    slidesForPart, addSlide, selectSlide,
    addElement, addImageElement, updateElement, removeElement, selectElement,
    setSlideBackground, setSlideBgColor, resetSlideToGlobal,
    navigateToNextPart, navigateToPart,
    removeSlide, getSnapshot, loadSnapshot, reset,
  }
})
