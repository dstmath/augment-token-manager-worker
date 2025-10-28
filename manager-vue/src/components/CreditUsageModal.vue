<template>
  <div class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-graph-up me-2"></i>
            Credit 使用统计
          </h5>
          <button type="button" class="btn-close" @click="handleClose"></button>
        </div>
        <div class="modal-body">
          <!-- Loading State -->
          <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">加载中...</span>
            </div>
            <p class="mt-3 text-muted">正在获取 Credit 使用数据...</p>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="alert alert-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>
            {{ error }}
          </div>

          <!-- Data Display -->
          <div v-else-if="statsData && chartData">
            <!-- Summary Cards -->
            <div class="row g-3 mb-4">
              <div class="col-md-4">
                <div class="card border-0 shadow-sm">
                  <div class="card-body">
                    <div class="d-flex align-items-center">
                      <div class="flex-shrink-0">
                        <div class="rounded-circle bg-primary bg-opacity-10 p-3">
                          <i class="bi bi-wallet2 fs-4 text-primary"></i>
                        </div>
                      </div>
                      <div class="flex-grow-1 ms-3">
                        <h6 class="text-muted mb-1">剩余 Credits</h6>
                        <h3 class="mb-0">{{ formatCredits(remainingCredits) }}</h3>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card border-0 shadow-sm">
                  <div class="card-body">
                    <div class="d-flex align-items-center">
                      <div class="flex-shrink-0">
                        <div class="rounded-circle bg-success bg-opacity-10 p-3">
                          <i class="bi bi-calendar-day fs-4 text-success"></i>
                        </div>
                      </div>
                      <div class="flex-grow-1 ms-3">
                        <h6 class="text-muted mb-1">今日消耗</h6>
                        <h3 class="mb-0">{{ todayCreditsDisplay }}</h3>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card border-0 shadow-sm">
                  <div class="card-body">
                    <div class="d-flex align-items-center">
                      <div class="flex-shrink-0">
                        <div class="rounded-circle bg-info bg-opacity-10 p-3">
                          <i class="bi bi-graph-up fs-4 text-info"></i>
                        </div>
                      </div>
                      <div class="flex-grow-1 ms-3">
                        <h6 class="text-muted mb-1">本周期总消耗</h6>
                        <h3 class="mb-0">{{ totalCreditsDisplay }}</h3>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Daily Usage Chart -->
            <div class="card border-0 shadow-sm mb-4">
              <div class="card-header bg-transparent">
                <h6 class="mb-0">
                  <i class="bi bi-bar-chart me-2"></i>
                  每日消耗趋势
                </h6>
              </div>
              <div class="card-body">
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th class="text-end">消耗 Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(point, index) in statsData.data_points" :key="index">
                        <td>{{ formatDate(point.date_range) }}</td>
                        <td class="text-end">
                          <span class="badge bg-primary">{{ formatCredits(point.credits_consumed) }}</span>
                        </td>
                      </tr>
                      <tr v-if="statsData.data_points.length === 0">
                        <td colspan="2" class="text-center text-muted">暂无数据</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Model Usage Chart -->
            <div class="card border-0 shadow-sm">
              <div class="card-header bg-transparent">
                <h6 class="mb-0">
                  <i class="bi bi-pie-chart me-2"></i>
                  按模型分类消耗
                </h6>
              </div>
              <div class="card-body">
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>模型</th>
                        <th class="text-end">消耗 Credits</th>
                        <th class="text-end">占比</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(point, index) in chartData.data_points" :key="index">
                        <td>
                          <span class="badge bg-secondary">{{ point.group_key || '未知' }}</span>
                        </td>
                        <td class="text-end">{{ formatCredits(point.credits_consumed) }}</td>
                        <td class="text-end">
                          <span class="text-muted">{{ calculatePercentage(point.credits_consumed) }}%</span>
                        </td>
                      </tr>
                      <tr v-if="chartData.data_points.length === 0">
                        <td colspan="3" class="text-center text-muted">暂无数据</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="handleClose">
            关闭
          </button>
          <button type="button" class="btn btn-primary" @click="refresh" :disabled="loading">
            <i class="bi bi-arrow-clockwise me-1"></i>
            刷新
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiPost } from '../utils/api'

interface DateRange {
  start_date_iso: string
  end_date_iso: string
}

interface CreditDataPoint {
  group_key?: string
  date_range?: DateRange
  credits_consumed: string
}

interface CreditConsumptionResponse {
  data_points: CreditDataPoint[]
}

interface Props {
  authSession: string
  creditsBalance: number
}

const props = defineProps<Props>()
const emit = defineEmits(['close', 'refresh-balance'])

const loading = ref(false)
const error = ref<string | null>(null)
const statsData = ref<CreditConsumptionResponse | null>(null)
const chartData = ref<CreditConsumptionResponse | null>(null)
const remainingCredits = ref(props.creditsBalance)

const fetchData = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await apiPost('/api/credits/consumption', {
      auth_session: props.authSession
    })

    const data = await response.json()

    if (data.success) {
      statsData.value = data.data.stats_data
      chartData.value = data.data.chart_data
    } else {
      error.value = data.error || data.message || '获取数据失败'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '获取数据失败'
    console.error('Failed to fetch credit data:', e)
  } finally {
    loading.value = false
  }
}

const refresh = () => {
  if (!loading.value) {
    fetchData()
    emit('refresh-balance')
  }
}

const handleClose = () => {
  emit('close')
}

const formatCredits = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '--'
  }
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return String(value)
  }
  return numeric.toLocaleString()
}

const formatDate = (dateRange?: DateRange): string => {
  if (!dateRange) return '--'
  try {
    const date = new Date(dateRange.start_date_iso)
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return '--'
  }
}

const todayCreditsDisplay = computed(() => {
  if (!statsData.value?.data_points?.length) return '0'
  const latestPoint = statsData.value.data_points[statsData.value.data_points.length - 1]
  return formatCredits(latestPoint?.credits_consumed || '0')
})

const totalCreditsDisplay = computed(() => {
  if (!statsData.value?.data_points?.length) return '0'
  const total = statsData.value.data_points.reduce((sum, point) => {
    const consumed = parseInt(point.credits_consumed) || 0
    return sum + consumed
  }, 0)
  return formatCredits(total)
})

const calculatePercentage = (credits: string): string => {
  if (!chartData.value?.data_points?.length) return '0'
  const total = chartData.value.data_points.reduce((sum, point) => {
    return sum + (parseInt(point.credits_consumed) || 0)
  }, 0)
  if (total === 0) return '0'
  const value = parseInt(credits) || 0
  return ((value / total) * 100).toFixed(1)
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.modal {
  display: block;
}

.card {
  transition: transform 0.2s;
}

.card:hover {
  transform: translateY(-2px);
}

.table th {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  color: var(--bs-secondary);
}
</style>

