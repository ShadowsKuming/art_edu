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
  rotation?: number   // degrees
  cropT?: number      // inset fractions 0-1
  cropR?: number
  cropB?: number
  cropL?: number
}

export interface Slide {
  id: string
  partId: number
  elements: SlideElement[]
  background?: string   // image data URL (clears bgColor)
  bgColor?: string      // solid color (clears background)
}

let elCounter = 0

export const useSlideStore = defineStore('slides', () => {
  const slides = ref<Slide[]>([])
  const activeSlideId = ref<string | null>(null)
  const selectedElementId = ref<string | null>(null)
  const activePart = ref<number>(2)

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
    slides.value.push({ id, partId, elements: [] })
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

  function setSlideBackground(slideId: string, bg: string) {
    const slide = slides.value.find(s => s.id === slideId)
    if (slide) { slide.background = bg; slide.bgColor = undefined }
  }

  function setSlideBgColor(slideId: string, color: string) {
    const slide = slides.value.find(s => s.id === slideId)
    if (slide) { slide.bgColor = color; slide.background = undefined }
  }

  function navigateToNextPart() {
    if (activePart.value < 7) activePart.value++
  }

  return {
    slides, activeSlideId, selectedElementId, activePart,
    activeSlide, selectedElement,
    slidesForPart, addSlide, selectSlide,
    addElement, addImageElement, updateElement, removeElement, selectElement,
    setSlideBackground, setSlideBgColor, navigateToNextPart,
  }
})
