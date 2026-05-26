import { createI18n } from 'vue-i18n'
import en from './en'
import zh from './zh'

const saved = localStorage.getItem('artbloom-locale') ?? 'zh'

export const i18n = createI18n({
  legacy: false,
  locale: saved,
  fallbackLocale: 'en',
  messages: { en, zh },
})

export function toggleLocale() {
  const next = i18n.global.locale.value === 'en' ? 'zh' : 'en'
  i18n.global.locale.value = next
  localStorage.setItem('artbloom-locale', next)
}
