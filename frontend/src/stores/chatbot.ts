import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  suggestions?: string[]
}

export const useChatbotStore = defineStore('chatbot', () => {
  const messages = ref<ChatMessage[]>([])

  function setMessages(msgs: ChatMessage[]) {
    messages.value = msgs
  }

  function push(msg: ChatMessage) {
    messages.value.push(msg)
  }

  return { messages, setMessages, push }
})
