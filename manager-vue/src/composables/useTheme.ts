import { ref, onMounted, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'auto'

const THEME_STORAGE_KEY = 'app-theme'

// 响应式主题状态
const currentTheme = ref<Theme>('auto')
const resolvedTheme = ref<'light' | 'dark'>('light')

// 获取系统偏好
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// 应用主题到DOM
const applyTheme = (theme: 'light' | 'dark') => {
  if (typeof document === 'undefined') return
  
  // 设置Bootstrap主题属性
  document.documentElement.setAttribute('data-bs-theme', theme)
  
  // 设置自定义主题属性（兼容现有样式）
  document.documentElement.setAttribute('data-theme', theme)
  
  // 更新resolved主题
  resolvedTheme.value = theme
}

// 解析主题值
const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'auto') {
    return getSystemTheme()
  }
  return theme
}

// 设置主题
const setTheme = (theme: Theme) => {
  currentTheme.value = theme
  
  // 保存到localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }
  
  // 应用解析后的主题
  const resolved = resolveTheme(theme)
  applyTheme(resolved)
}

// 切换主题
const toggleTheme = () => {
  const themes: Theme[] = ['light', 'dark', 'auto']
  const currentIndex = themes.indexOf(currentTheme.value)
  const nextIndex = (currentIndex + 1) % themes.length
  setTheme(themes[nextIndex])
}

// 获取主题图标
const getThemeIcon = (theme?: Theme): string => {
  const t = theme || currentTheme.value
  switch (t) {
    case 'light':
      return 'bi-sun-fill'
    case 'dark':
      return 'bi-moon-fill'
    case 'auto':
      return 'bi-circle-half'
    default:
      return 'bi-circle-half'
  }
}

// 获取主题标签
const getThemeLabel = (theme?: Theme): string => {
  const t = theme || currentTheme.value
  switch (t) {
    case 'light':
      return '浅色模式'
    case 'dark':
      return '深色模式'
    case 'auto':
      return '跟随系统'
    default:
      return '跟随系统'
  }
}

// 主题切换组合式函数
export const useTheme = () => {
  // 初始化主题
  onMounted(() => {
    // 从localStorage读取保存的主题
    let savedTheme: Theme = 'auto'
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme
      if (stored && ['light', 'dark', 'auto'].includes(stored)) {
        savedTheme = stored
      }
    }
    
    // 设置初始主题
    setTheme(savedTheme)
    
    // 监听系统主题变化
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleSystemThemeChange = () => {
        if (currentTheme.value === 'auto') {
          const resolved = resolveTheme('auto')
          applyTheme(resolved)
        }
      }
      
      mediaQuery.addEventListener('change', handleSystemThemeChange)
      
      // 清理监听器
      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange)
      }
    }
  })
  
  // 监听主题变化
  watch(currentTheme, (newTheme) => {
    const resolved = resolveTheme(newTheme)
    applyTheme(resolved)
  })
  
  return {
    currentTheme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    getThemeIcon,
    getThemeLabel
  }
}

// 导出单例实例
export { currentTheme, resolvedTheme, setTheme, toggleTheme, getThemeIcon, getThemeLabel }
