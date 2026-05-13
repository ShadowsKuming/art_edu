import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'

// Global styles — order matters: fonts → tokens → base → existing tailwind layer.
import '@/assets/styles/fonts.css'
import '@/assets/styles/tokens.css'
import '@/assets/styles/base.css'
import './style.css'

createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
