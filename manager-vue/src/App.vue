<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'
import NavigationBar from './components/NavigationBar.vue'
import ToastNotification from './components/ToastNotification.vue'
import { useTheme } from './composables/useTheme'

const route = useRoute()

// 判断是否为登录页面
const isLoginPage = computed(() => route.path === '/login')

// 初始化主题系统
useTheme()
</script>

<template>
  <!-- 登录页面布局 -->
  <div v-if="isLoginPage">
    <RouterView />
  </div>

  <!-- 管理页面布局 -->
  <div v-else class="page">
    <NavigationBar />
    <div class="page-wrapper">
      <div class="page-body" style="padding-bottom: 30px;">
        <div class="container-xl">
          <RouterView />
        </div>
      </div>
      <!-- 版权信息 -->
      <footer class="footer footer-transparent d-print-none app-footer">
        <div class="container-xl">
          <div class="text-center">
            <span class="footer-text">
              &copy; 2025
              <a href="https://github.com/qianshe/augment-token-manager-worker" target="_blank" class="footer-link">qianshe</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  </div>

  <!-- 全局提示组件 -->
  <ToastNotification />
</template>

<style scoped>
/* 页脚主题适配样式 */
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--bs-body-bg, rgba(255, 255, 255, 0.95));
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--bs-border-color);
  padding: 8px 0;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

[data-bs-theme="dark"] .app-footer {
  background: var(--bs-body-bg, rgba(33, 37, 41, 0.95));
}

.footer-text {
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
}

.footer-link {
  color: var(--bs-link-color);
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer-link:hover {
  color: var(--bs-link-hover-color);
  text-decoration: underline;
}
</style>
