import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePart5Store = defineStore('part5', () => {
  const videoDataUrl = ref<string | null>(null)
  const videoName = ref<string>('')

  function setVideo(dataUrl: string, name: string) {
    videoDataUrl.value = dataUrl
    videoName.value = name
  }

  function clearVideo() {
    videoDataUrl.value = null
    videoName.value = ''
  }

  return { videoDataUrl, videoName, setVideo, clearVideo }
})
