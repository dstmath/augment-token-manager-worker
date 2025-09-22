<template>
  <div class="dropdown" ref="dropdownRef">
    <button
      class="btn btn-outline-secondary dropdown-toggle"
      type="button"
      @click="toggleDropdown"
      :aria-expanded="isDropdownOpen"
      :title="getThemeLabel()"
    >
      <i :class="getThemeIcon()"></i>
    </button>
    <ul class="dropdown-menu dropdown-menu-end" :class="{ show: isDropdownOpen }">
      <li>
        <button
          class="dropdown-item d-flex align-items-center"
          :class="{ active: currentTheme === 'light' }"
          @click="handleThemeSelect('light')"
        >
          <i class="bi-sun-fill me-2"></i>
          Light
          <i v-if="currentTheme === 'light'" class="bi-check ms-1"></i>
        </button>
      </li>
      <li>
        <button
          class="dropdown-item d-flex align-items-center"
          :class="{ active: currentTheme === 'dark' }"
          @click="handleThemeSelect('dark')"
        >
          <i class="bi-moon-fill me-2"></i>
          Dark
          <i v-if="currentTheme === 'dark'" class="bi-check ms-1"></i>
        </button>
      </li>
      <li>
        <button
          class="dropdown-item d-flex align-items-center"
          :class="{ active: currentTheme === 'auto' }"
          @click="handleThemeSelect('auto')"
        >
          <i class="bi-circle-half me-2"></i>
          Auto
          <i v-if="currentTheme === 'auto'" class="bi-check ms-1"></i>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useTheme, type Theme } from '../composables/useTheme'

const { currentTheme, setTheme, getThemeIcon, getThemeLabel } = useTheme()

// 下拉菜单状态
const isDropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement>()

// 切换下拉菜单
const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

// 处理主题选择
const handleThemeSelect = (theme: Theme) => {
  setTheme(theme)
  isDropdownOpen.value = false
}

// 处理点击外部区域关闭下拉菜单
const handleClickOutside = (event: Event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 1000;
  display: none;
  min-width: 10rem;
  padding: 0.5rem 0;
  margin: 0.125rem 0 0;
  background-color: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}

.dropdown-menu.show {
  display: block;
}

.dropdown-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: var(--bs-body-color);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out;
}

.dropdown-item:hover {
  background-color: var(--bs-secondary-bg);
}

.dropdown-item.active {
  background-color: var(--bs-primary);
  color: var(--bs-white);
}

.btn {
  border-color: var(--bs-border-color);
  color: var(--bs-body-color);
  background-color: transparent;
}

.btn:hover {
  background-color: var(--bs-secondary-bg);
  border-color: var(--bs-border-color);
  color: var(--bs-body-color);
}

.btn:focus {
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}
</style>
