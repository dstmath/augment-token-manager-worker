import '@tabler/core/dist/css/tabler.min.css'
import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'
import './assets/theme-variables.css'
import './assets/base.css'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createBootstrap } from 'bootstrap-vue-next'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(createBootstrap())

app.mount('#app')
