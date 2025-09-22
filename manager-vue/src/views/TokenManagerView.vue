<template>
  <div class="token-manager">
    <!-- 页面标题 -->
    <div class="page-header d-print-none">
      <div class="container-xl">
        <div class="row g-2 align-items-center">
          <div class="col">
            <h2 class="page-title">Token 管理</h2>
          </div>
          <div class="col-auto ms-auto d-print-none">
            <div class="btn-list">
              <!-- 视图切换按钮 -->
              <div class="btn-group" role="group">
                <button
                  type="button"
                  :class="['btn', viewMode === 'card' ? 'btn-primary' : 'btn-outline-primary']"
                  @click="viewMode = 'card'"
                  title="卡片视图"
                >
                  <i class="bi bi-grid-3x3-gap"></i>
                </button>
                <button
                  type="button"
                  :class="['btn', viewMode === 'table' ? 'btn-primary' : 'btn-outline-primary']"
                  @click="viewMode = 'table'"
                  title="表格视图"
                >
                  <i class="bi bi-table"></i>
                </button>
              </div>
              <button
                @click="toggleSelectMode"
                :class="['btn', isSelectMode ? 'btn-primary' : 'btn-outline-primary']"
                :title="isSelectMode ? '退出选择模式' : '进入选择模式'"
              >
                <i :class="['bi', 'me-sm-2', isSelectMode ? 'bi-check-square' : 'bi-square']"></i>
                <span class="d-none d-sm-inline">{{ isSelectMode ? '退出选择' : '批量选择' }}</span>
              </button>
              <button
                @click="validateSelectedTokens"
                class="btn btn-warning"
                :disabled="!isSelectMode || selectedTokenIds.size === 0"
                :title="isSelectMode ? `验证选中的 ${selectedTokenIds.size} 个Token` : '请先进入选择模式'"
              >
                <i class="bi bi-check-circle me-sm-2"></i>
                <span class="d-none d-sm-inline">
                  {{ isSelectMode && selectedTokenIds.size > 0 ? `验证 (${selectedTokenIds.size})` : '验证' }}
                </span>
              </button>
              <button
                @click="refreshSelectedTokens"
                class="btn btn-secondary"
                :disabled="!isSelectMode || selectedTokenIds.size === 0 || isBatchRefreshing"
                :title="isSelectMode ? `刷新选中的 ${selectedTokenIds.size} 个Token` : '请先进入选择模式'"
              >
                <i
                  :class="['bi', 'me-sm-2',
                    isBatchRefreshing ? 'bi-arrow-clockwise refresh-spin' : 'bi-arrow-clockwise']"
                  :style="isBatchRefreshing ? 'animation: refresh-rotate 1s linear infinite; transform-origin: center center; display: inline-block;' : ''"
                ></i>
                <span class="d-none d-sm-inline">
                  {{ isBatchRefreshing ? '刷新中...' :
                     (isSelectMode && selectedTokenIds.size > 0 ? `刷新 (${selectedTokenIds.size})` : '刷新') }}
                </span>
              </button>
              <button @click="() => showGetTokenModal(false)" class="btn btn-success" title="添加 Token">
                <i class="bi bi-link-45deg me-sm-2"></i>
                <span class="d-none d-sm-inline">添加</span>
              </button>
              <button @click="showAddTokenModal" class="btn btn-info" title="导入 Token">
                <i class="bi bi-plus-circle me-sm-2"></i>
                <span class="d-none d-sm-inline">导入</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="page-body">
      <div class="container-xl">
        <!-- 状态统计窗口 -->
        <div class="row mb-4">
          <div class="col-6 col-xl-2 col-lg-3">
            <div
              class="card card-sm cursor-pointer"
              :class="{ 'border-success': activeFilter === '正常' }"
              @click="toggleFilter('正常')"
            >
              <div class="card-body">
                <div class="row align-items-center">
                  <div class="col-auto">
                    <span class="bg-success text-white avatar">
                      <i class="bi bi-check-circle"></i>
                    </span>
                  </div>
                  <div class="col">
                    <div class="font-weight-medium">
                      正常
                    </div>
                  </div>
                  <div class="col-auto">
                    <div class="h1 mb-0 text-success">{{ statusStats.normal }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-6 col-xl-2 col-lg-3">
            <div
              class="card card-sm cursor-pointer"
              :class="{ 'border-warning': activeFilter === '失效' }"
              @click="toggleFilter('失效')"
            >
              <div class="card-body">
                <div class="row align-items-center">
                  <div class="col-auto">
                    <span class="bg-warning text-dark avatar">
                      <i class="bi bi-x-circle"></i>
                    </span>
                  </div>
                  <div class="col">
                    <div class="font-weight-medium">
                      失效
                    </div>
                  </div>
                  <div class="col-auto">
                    <div class="h1 mb-0 text-warning">{{ statusStats.invalid }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-6 col-xl-2 col-lg-3">
            <div
              class="card card-sm cursor-pointer"
              :class="{ 'border-danger': activeFilter === '不可用' }"
              @click="toggleFilter('不可用')"
            >
              <div class="card-body">
                <div class="row align-items-center">
                  <div class="col-auto">
                    <span class="bg-danger text-white avatar">
                      <i class="bi bi-x-circle"></i>
                    </span>
                  </div>
                  <div class="col">
                    <div class="font-weight-medium">
                      不可用
                    </div>
                  </div>
                  <div class="col-auto">
                    <div class="h1 mb-0 text-danger">{{ statusStats.banned + statusStats.exhausted + statusStats.expired }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-6 col-xl-2 col-lg-3">
            <div
              class="card card-sm cursor-pointer"
              :class="{ 'border-secondary': activeFilter === '未知' }"
              @click="toggleFilter('未知')"
            >
              <div class="card-body">
                <div class="row align-items-center">
                  <div class="col-auto">
                    <span class="bg-secondary text-white avatar">
                      <i class="bi bi-question-circle"></i>
                    </span>
                  </div>
                  <div class="col">
                    <div class="font-weight-medium">
                      未知
                    </div>
                  </div>
                  <div class="col-auto">
                    <div class="h1 mb-0 text-secondary">{{ statusStats.unknown }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-6 col-xl-2 col-lg-3">
            <div
              class="card card-sm cursor-pointer"
              :class="{ 'border-indigo': activeFilter === '已分享' }"
              @click="toggleFilter('已分享')"
            >
              <div class="card-body">
                <div class="row align-items-center">
                  <div class="col-auto">
                    <span class="bg-indigo text-white avatar">
                      <i class="bi bi-share"></i>
                    </span>
                  </div>
                  <div class="col">
                    <div class="font-weight-medium">
                      已分享
                    </div>
                  </div>
                  <div class="col-auto">
                    <div class="h1 mb-0 text-indigo">{{ sharedTokensCount }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- 卡片视图 -->
        <div v-if="viewMode === 'card'" class="row row-cards">
          <div v-for="token in tokens" :key="token.id" class="col-sm-6 col-lg-4">
            <div
              :class="[
                'card',
                {
                  'border-primary': isSelectMode && selectedTokenIds.has(token.id),
                  'card-selectable': isSelectMode
                }
              ]"
              @click="isSelectMode ? toggleTokenSelection(token.id) : null"
              :style="isSelectMode ? 'cursor: pointer;' : ''"
            >
              <div class="card-body">

                <!-- 卡片头部 -->
                <div class="d-flex align-items-center mb-3">
                  <div class="flex-fill">
                    <div class="font-weight-medium">
                      {{ token.email_note || '未设置备注' }}
                      <span
                        v-if="isTokenShared(token)"
                        class="badge bg-indigo text-white ms-2 cursor-pointer"
                        @click="showShareInfoModal(token)"
                        title="点击查看分享信息"
                      >
                        已分享
                      </span>
                    </div>
                    <div class="text-muted small">过期时间: {{ getExpiryDate(token) }}</div>
                  </div>
                  <div class="ms-auto">
                    <span
                      :class="['badge', 'cursor-pointer',
                        isValidating && validatingToken?.id === token.id ? 'bg-warning text-white' :
                        getTokenStatusClass(token)]"
                      @click="handleStatusClick(token)"
                      :title="isTokenShared(token) ? '点击查看分享信息和激活码' : (getTokenStatus(token) === '失效' ? '点击选择操作（验证或重新激活）' : '点击验证Token状态')"
                    >
                      <span v-if="isValidating && validatingToken?.id === token.id" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      {{ isValidating && validatingToken?.id === token.id ? '验证中' : getTokenStatus(token) }}
                    </span>
                  </div>
                </div>

                <!-- 统计信息 -->
                <div class="row mb-3">
                  <div class="col-6">
                    <div class="text-muted small">剩余时长</div>
                    <div :class="['h4', 'mb-0', getDaysColorClass(token)]">
                      {{ formatRemainingTime(token) }}
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="text-muted small">剩余次数</div>
                    <div :class="['h4', 'mb-0', getCreditsColorClass(token)]">
                      {{ getRemainingCredits(token) }}
                    </div>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="btn-list w-100">
                  <button @click="executeToken(token)" class="btn btn-primary flex-fill">
                    <i class="bi bi-play-fill me-1"></i>
                    执行
                  </button>
                  <button
                    @click="refreshToken(token)"
                    class="btn btn-success"
                    :disabled="isRefreshing && refreshingToken?.id === token.id"
                  >
                    <i
                      :class="['bi',
                        isRefreshing && refreshingToken?.id === token.id ? 'bi-arrow-clockwise refresh-spin' : 'bi-arrow-clockwise']"
                    ></i>
                  </button>
                  <button @click="showEditTokenModal(token)" class="btn btn-warning">
                    <i class="bi bi-pencil-fill"></i>
                  </button>
                  <button @click="showDeleteTokenModal(token)" class="btn btn-danger">
                    <i class="bi bi-trash-fill"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 表格视图 -->
        <div v-if="viewMode === 'table'" class="card">
          <div class="table-responsive" style="border-radius: 0.5rem; overflow: hidden;">
            <table class="table table-vcenter card-table" style="margin-bottom: 0;">
              <thead>
                <tr>
                  <th v-if="isSelectMode" class="text-center" style="width: 50px;">
                    <input
                      type="checkbox"
                      class="form-check-input"
                      :checked="isAllSelected"
                      @change="toggleSelectAll"
                      title="全选/取消全选"
                    />
                  </th>
                  <th>邮箱备注</th>
                  <th
                    class="sortable-header text-center"
                    @click="sortTokens('expiry_date')"
                    :class="{ 'sorted': sortField === 'expiry_date' }"
                  >
                    过期时间
                    <i
                      v-if="sortField === 'expiry_date'"
                      :class="['bi', 'ms-1', sortOrder === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down']"
                    ></i>
                    <i v-else class="bi bi-arrow-up-down ms-1 text-muted"></i>
                  </th>
                  <th class="text-center">剩余时长</th>
                  <th
                    class="sortable-header text-center"
                    @click="sortTokens('credits_balance')"
                    :class="{ 'sorted': sortField === 'credits_balance' }"
                  >
                    剩余次数
                    <i
                      v-if="sortField === 'credits_balance'"
                      :class="['bi', 'ms-1', sortOrder === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down']"
                    ></i>
                    <i v-else class="bi bi-arrow-up-down ms-1 text-muted"></i>
                  </th>
                  <th class="text-center">状态</th>
                  <th class="w-1 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="token in tokens" :key="token.id">
                  <td v-if="isSelectMode" class="text-center">
                    <input
                      type="checkbox"
                      class="form-check-input"
                      :checked="selectedTokenIds.has(token.id)"
                      @change="toggleTokenSelection(token.id)"
                    />
                  </td>
                  <td class="text-muted">
                    {{ token.email_note || '未设置备注' }}
                    <span
                      v-if="isTokenShared(token)"
                      class="badge bg-indigo text-white ms-2 cursor-pointer"
                      @click="showShareInfoModal(token)"
                      title="点击查看分享信息"
                    >
                      已分享
                    </span>
                  </td>
                  <td :class="['text-center', getDaysColorClass(token)]">
                    {{ getExpiryDate(token) }}
                  </td>
                  <td :class="['text-center', getDaysColorClass(token)]">
                    {{ formatRemainingTime(token) }}
                  </td>
                  <td :class="['text-center', getCreditsColorClass(token)]">
                    {{ getRemainingCredits(token) }}
                  </td>
                  <td class="text-center">
                    <span
                      :class="['badge', 'cursor-pointer',
                        isValidating && validatingToken?.id === token.id ? 'bg-warning text-white' :
                        getTokenStatusClass(token)]"
                      @click="handleStatusClick(token)"
                      :title="isTokenShared(token) ? '点击查看分享信息和激活码' : (getTokenStatus(token) === '失效' ? '点击选择操作（验证或重新激活）' : '点击验证Token状态')"
                    >
                      <span v-if="isValidating && validatingToken?.id === token.id" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      {{ isValidating && validatingToken?.id === token.id ? '验证中' : getTokenStatus(token) }}
                    </span>
                  </td>
                  <td>
                    <div class="btn-list flex-nowrap">
                      <button @click="executeToken(token)" class="btn btn-sm btn-primary">
                        <i class="bi bi-play-fill me-1"></i>
                        执行
                      </button>
                      <button
                        @click="refreshToken(token)"
                        class="btn btn-sm btn-success"
                        :disabled="isRefreshing && refreshingToken?.id === token.id"
                      >
                        <i
                          :class="['bi', 'me-1',
                            isRefreshing && refreshingToken?.id === token.id ? 'bi-arrow-clockwise refresh-spin' : 'bi-arrow-clockwise']"
                        ></i>
                        {{ isRefreshing && refreshingToken?.id === token.id ? '刷新中...' : '刷新' }}
                      </button>
                      <button @click="showEditTokenModal(token)" class="btn btn-sm btn-warning">
                        <i class="bi bi-pencil-fill me-1"></i>
                        编辑
                      </button>
                      <button @click="showDeleteTokenModal(token)" class="btn btn-sm btn-danger">
                        <i class="bi bi-trash-fill me-1"></i>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 分页 -->
        <div class="d-flex align-items-center justify-content-between mt-4">
          <div class="text-muted">
            显示 {{ (pagination.page - 1) * pagination.limit + 1 }} 到
            {{ Math.min(pagination.page * pagination.limit, pagination.total) }} 条，
            共 {{ pagination.total }} 条记录
          </div>
          <div class="d-flex align-items-center">
            <ul class="pagination m-0 ms-auto">
              <li class="page-item" :class="{ disabled: !pagination.has_prev }">
                <button
                  class="page-link"
                  @click="loadTokens(pagination.page - 1)"
                  :disabled="!pagination.has_prev"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <polyline points="15,6 9,12 15,18"/>
                  </svg>
                  上一页
                </button>
              </li>
              <li
                v-for="page in getPageNumbers()"
                :key="page"
                class="page-item"
                :class="{ active: page === pagination.page }"
              >
                <button class="page-link" @click="loadTokens(page)">{{ page }}</button>
              </li>
              <li class="page-item" :class="{ disabled: !pagination.has_next }">
                <button
                  class="page-link"
                  @click="loadTokens(pagination.page + 1)"
                  :disabled="!pagination.has_next"
                >
                  下一页
                  <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <polyline points="9,6 15,12 9,18"/>
                  </svg>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 获取 Token 模态框 -->
    <div v-if="showGetModal" class="modal modal-blur fade show" style="display: block;">
      <div class="modal-dialog modal-lg modal-dialog-centered" role="document" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">获取 Token</h5>
            <button type="button" class="btn-close" @click="closeGetModal"></button>
          </div>
          <div class="modal-body">
            <!-- 步骤指示器 -->
            <div class="steps-wrapper mb-4">
              <div class="steps">
                <div class="step" :class="{ 'step-active': getTokenStep >= 1, 'step-completed': getTokenStep > 1 }">
                  <div class="step-number">1</div>
                  <div class="step-title">生成授权URL</div>
                </div>
                <div class="step-divider" :class="{ 'divider-active': getTokenStep > 1 }"></div>
                <div class="step" :class="{ 'step-active': getTokenStep >= 2, 'step-completed': getTokenStep > 2 }">
                  <div class="step-number">2</div>
                  <div class="step-title">输入授权响应</div>
                </div>
                <div class="step-divider" :class="{ 'divider-active': getTokenStep > 2 }"></div>
                <div class="step" :class="{ 'step-active': getTokenStep >= 3 }">
                  <div class="step-number">3</div>
                  <div class="step-title">获取Token</div>
                </div>
              </div>
            </div>
            <!-- 第一步：生成授权URL -->
            <div v-if="getTokenStep === 1">
              <h6 class="mb-3">第一步：生成授权URL</h6>
              <div class="mb-3">
                <label class="form-label">授权URL</label>
                <div class="input-group">
                  <input
                    type="text"
                    v-model="authUrl"
                    class="form-control"
                    placeholder="点击生成授权URL按钮"
                    readonly
                  >
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="copyAuthUrl"
                    :disabled="!authUrl"
                    title="复制URL"
                  >
                    <i class="bi bi-clipboard"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-primary"
                    @click="openAuthUrl"
                    :disabled="!authUrl"
                    title="在浏览器中打开"
                  >
                    <i class="bi bi-box-arrow-up-right"></i>
                  </button>
                </div>
              </div>

            </div>

            <!-- 第二步：输入授权响应 -->
            <div v-if="getTokenStep === 2">
              <h6 class="mb-3">第二步：输入授权响应</h6>
              <p class="text-muted mb-3">请在浏览器中完成授权，然后将获得的响应信息粘贴到下方：</p>

              <!-- 授权响应输入 -->
              <div class="mb-3">
                <label class="form-label">授权响应JSON</label>
                <textarea
                  v-model="authResponse"
                  :class="['form-control', authResponseError ? 'is-invalid' : '']"
                  rows="4"
                  placeholder="{
    &quot;code&quot;: &quot;your_code&quot;,
    &quot;state&quot;: &quot;random_string&quot;,
    &quot;tenant_url&quot;: &quot;https://example.api.augmentcode.com/&quot;
}"
                  @input="validateAuthResponse"
                ></textarea>
                <div v-if="authResponseError" class="invalid-feedback">
                  {{ authResponseError }}
                </div>
                <div class="form-hint mt-2">
                  <strong>格式要求：</strong>必须是JSON格式，包含 code、state、tenant_url 三个字段<br>
                </div>
              </div>

              <!-- 邮箱生成面板 -->
              <div class="card mb-3 border-primary">
                <div class="card-header bg-primary-lt">
                  <div class="d-flex align-items-center justify-content-between">
                    <h6 class="card-title mb-0 text-primary">
                      <i class="bi bi-envelope me-2"></i>
                      {{ isReactivateMode ? '邮箱信息' : '邮箱生成工具' }}
                    </h6>
                    <div v-if="isReactivateMode" class="badge bg-info text-white">
                      重激活模式
                    </div>
                  </div>
                  <div v-if="isReactivateMode" class="text-muted small mt-1">
                    使用原邮箱，不可生成新邮箱
                  </div>
                </div>
                <div class="card-body p-4">
                  <div class="row g-4">
                    <!-- 邮箱生成设置 -->
                    <div class="col-lg-6" v-if="!isReactivateMode">
                      <!-- 邮箱配置区域 - 减少高度和留白 -->
                      <div class="mb-2" style="padding-top: 8px;">
                        <label class="form-label fw-semibold">
                          <i class="bi bi-gear me-1"></i>
                          邮箱类型
                        </label>
                        <select v-model="emailType" class="form-select">
                          <option value="mixed">混合（字母+数字）</option>
                          <option value="word">单词（含前缀）</option>
                        </select>
                      </div>

                      <!-- 分割线 -->
                      <div class="border-top pt-2"></div>

                      <div class="row">
                        <div class="col-sm-6">
                          <div class="mb-3">
                            <label class="form-label fw-semibold">
                              <i class="bi bi-rulers me-1"></i>
                              长度
                            </label>
                            <input
                              type="number"
                              v-model="emailLength"
                              class="form-control"
                              min="8"
                              max="15"
                              placeholder="8-15字符"
                            >
                          </div>
                        </div>
                        <div class="col-sm-6">
                          <div class="mb-3">
                            <label class="form-label fw-semibold">
                              <i class="bi bi-globe me-1"></i>
                              域名
                            </label>
                            <select v-model="selectedDomain" class="form-select">
                              <option value="">随机选择</option>
                              <option v-for="domain in emailDomains" :key="domain" :value="domain">
                                {{ domain }}
                              </option>
                              <option value="custom">自定义域名</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div class="mb-3" v-if="selectedDomain === 'custom'">
                        <label class="form-label fw-semibold">
                          <i class="bi bi-pencil me-1"></i>
                          自定义域名
                        </label>
                        <input
                          type="text"
                          v-model="customDomain"
                          class="form-control"
                          placeholder="example.com"
                        >
                      </div>

                      <div class="mb-3" v-if="emailType === 'word'">
                        <label class="form-label fw-semibold">
                          <i class="bi bi-type me-1"></i>
                          前缀（可选）
                        </label>
                        <input
                          type="text"
                          v-model="emailPrefix"
                          class="form-control"
                          placeholder="输入前缀"
                          maxlength="10"
                        >
                      </div>
                    </div>

                    <!-- 重激活模式提示 -->
                    <div class="col-lg-6" v-if="isReactivateMode">
                      <div class="alert alert-info border-info" style="margin-top: 50px;">
                        <div class="d-flex">
                          <div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                              <path d="M12 8v4l3 3"/>
                              <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/>
                            </svg>
                          </div>
                          <div>
                            <h6 class="alert-title">重激活模式</h6>
                            <p class="mb-0">正在使用原Token的邮箱进行重激活，无法生成新邮箱。</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 邮箱和验证码 -->
                    <div class="col-lg-6">
                      <!-- 邮箱显示区域 - 减少高度和留白 -->
                      <div class="mb-2" style="padding-top: 8px;">
                        <label class="form-label fw-semibold">
                          <i class="bi bi-envelope-check me-1"></i>
                          {{ isReactivateMode ? '使用的邮箱' : '生成的邮箱' }}
                        </label>
                        <div class="input-group">
                          <input
                            type="text"
                            :value="generatedEmail"
                            :class="['form-control', generatedEmail ? (isReactivateMode ? 'bg-info-lt' : 'bg-success-lt') : '']"
                            :placeholder="isReactivateMode ? '原邮箱信息' : '点击生成邮箱'"
                            readonly
                          >
                          <button
                            type="button"
                            :class="['btn', isReactivateMode ? 'btn-info' : 'btn-success']"
                            @click="copyEmail"
                            :disabled="!generatedEmail"
                            title="复制邮箱"
                          >
                            <i class="bi bi-clipboard"></i>
                          </button>
                          <button
                            v-if="!isReactivateMode"
                            type="button"
                            class="btn btn-primary"
                            @click="generateEmail"
                            :disabled="isGeneratingEmail"
                            title="生成邮箱"
                          >
                            <i :class="['bi', isGeneratingEmail ? 'bi-arrow-clockwise refresh-spin' : 'bi-arrow-clockwise']"></i>
                          </button>
                        </div>
                      </div>

                      <!-- 验证码获取 -->
                      <div class="border-top pt-2">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                          <label class="form-label fw-semibold mb-0" style="line-height: 1;">
                            <i class="bi bi-shield-check me-1"></i>
                            验证码
                          </label>
                          <div class="form-check form-switch mb-0" style="margin: 0; padding: 0; display: flex; align-items: center; gap: 6px;">
                            <input
                              class="form-check-input"
                              type="checkbox"
                              v-model="autoRefreshVerificationCode"
                              @change="toggleAutoRefresh"
                              style="margin: 0; flex-shrink: 0;"
                            >
                            <label class="form-check-label small mb-0" style="line-height: 1; margin: 0;">
                              自动刷新
                              <span v-if="autoRefreshVerificationCode" class="text-muted">
                                (10s)
                              </span>
                            </label>
                          </div>
                        </div>

                        <div class="input-group mb-1">
                          <input
                            type="text"
                            :value="verificationCode"
                            :class="['form-control', verificationCode ? 'bg-warning-lt' : '']"
                            placeholder="点击获取验证码"
                            readonly
                          >
                          <button
                            type="button"
                            class="btn btn-warning"
                            @click="copyVerificationCode"
                            :disabled="!verificationCode"
                            title="复制验证码"
                          >
                            <i class="bi bi-clipboard"></i>
                          </button>
                          <button
                            type="button"
                            class="btn btn-primary"
                            @click="getVerificationCode"
                            :disabled="isGettingVerificationCode"
                            title="获取验证码"
                          >
                            <i :class="['bi', isGettingVerificationCode ? 'bi-arrow-clockwise refresh-spin' : 'bi-arrow-clockwise']"></i>
                          </button>
                        </div>

                        <div class="alert alert-light border-0 py-1 mt-1" :style="{ visibility: verificationEmail && verificationTimestamp ? 'visible' : 'hidden' }">
                          <div class="small text-muted">
                            <i class="bi bi-info-circle me-1"></i>
                            <span v-if="verificationEmail && verificationTimestamp">{{ verificationEmail }} · {{ formatTimestamp(verificationTimestamp) }}</span>
                            <span v-else>&nbsp;</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="!isReactivateMode" class="mb-3">
                <label class="form-label">Portal URL（可选）</label>
                <input
                  type="text"
                  v-model="portalUrl"
                  class="form-control"
                  placeholder="请输入Portal URL（可选）"
                >
              </div>
              <div v-if="isReactivateMode" class="mb-3">
                <label class="form-label">Portal URL</label>
                <input
                  type="text"
                  :value="reactivatingToken?.portal_url || ''"
                  class="form-control bg-info-lt"
                  placeholder="使用原Token的Portal URL"
                  readonly
                >
                <div class="form-hint">重新激活模式下将使用原Token的Portal URL</div>
              </div>
            </div>

            <!-- 第三步：保存Token -->
            <div v-if="getTokenStep === 3">
              <h6 class="mb-3">第三步：{{ isReactivateMode ? '更新Token' : '保存Token' }}</h6>
              <div v-if="tokenData.tenant_url">
                <div class="alert alert-success">
                  <h6>{{ isReactivateMode ? 'Token重新激活成功！' : 'Token获取成功！' }}</h6>
                  <div v-if="isReactivateMode" class="small text-muted mt-1">
                    将覆盖原Token记录：{{ reactivatingToken?.id }}
                  </div>
                </div>
                <form @submit.prevent="saveToken">
                  <div class="mb-3">
                    <label class="form-label">Tenant URL</label>
                    <input
                      type="text"
                      :value="tokenData.tenant_url"
                      class="form-control"
                      readonly
                    >
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Access Token</label>
                    <textarea
                      :value="tokenData.access_token"
                      class="form-control"
                      rows="3"
                      readonly
                    ></textarea>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">邮箱备注（可选）</label>
                    <input
                      type="text"
                      v-model="emailNote"
                      class="form-control"
                      placeholder="请输入邮箱或备注信息（可选）"
                    >
                  </div>
                </form>
              </div>
              <div v-else>
                <p class="text-muted">请先完成前面的步骤...</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn me-auto" @click="closeGetModal">取消</button>

            <!-- 第一步按钮 -->
            <div v-if="getTokenStep === 1" class="d-flex gap-2">
              <button
                type="button"
                class="btn btn-success"
                @click="generateAuthUrl"
                :disabled="isGeneratingUrl || isGenerateOnCooldown"
              >
                <i
                  :class="['bi', 'me-1',
                    isGeneratingUrl ? 'bi-arrow-clockwise refresh-spin' :
                    isGenerateOnCooldown ? 'bi-clock' : 'bi-link-45deg']"
                ></i>
                {{
                  isGeneratingUrl ? '生成中...' :
                  isGenerateOnCooldown ? `等待 ${remainingCooldownTime}s` :
                  '生成授权URL'
                }}
              </button>
              <button
                type="button"
                class="btn btn-primary"
                @click="nextStep"
                :disabled="!authUrl"
              >
                <i class="bi bi-arrow-right me-1"></i>
                下一步
              </button>
            </div>

            <!-- 第二步按钮 -->
            <div v-if="getTokenStep === 2" class="d-flex gap-2">
              <button
                type="button"
                class="btn btn-secondary"
                @click="prevStep"
              >
                <i class="bi bi-arrow-left me-1"></i>
                上一步
              </button>
              <button
                type="button"
                class="btn btn-primary"
                @click="validateAndNextStep"
                :disabled="!authResponse || !!authResponseError || isValidatingResponse"
              >
                <i
                  :class="['bi', 'me-1',
                    isValidatingResponse ? 'bi-arrow-clockwise refresh-spin' : 'bi-arrow-right']"
                ></i>
                {{ isValidatingResponse ? '验证中...' : '下一步' }}
              </button>
            </div>

            <!-- 第三步按钮 -->
            <div v-if="getTokenStep === 3" class="d-flex gap-2">
              <button
                type="button"
                class="btn btn-secondary"
                @click="prevStep"
              >
                <i class="bi bi-arrow-left me-1"></i>
                上一步
              </button>
              <button
                v-if="tokenData.tenant_url"
                type="button"
                class="btn btn-success"
                @click="saveToken"
                :disabled="isSavingToken"
              >
                <i
                  :class="['bi', 'me-1',
                    isSavingToken ? 'bi-arrow-clockwise refresh-spin' : 'bi-floppy']"
                ></i>
                {{ isSavingToken ? (isReactivateMode ? '更新中...' : '保存中...') : (isReactivateMode ? '更新Token' : '保存Token') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑 Token 模态框 -->
    <div v-if="showEditModal" class="modal modal-blur fade show" style="display: block;">
      <div class="modal-dialog modal-lg modal-dialog-centered" role="document" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">编辑 Token</h5>
            <button type="button" class="btn-close" @click="closeEditModal"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="updateToken">
              <div class="mb-3">
                <label class="form-label">Tenant URL</label>
                <input
                  type="url"
                  v-model="editingToken.tenant_url"
                  class="form-control"
                  placeholder="请输入 Tenant URL"
                  required
                >
              </div>
              <div class="mb-3">
                <label class="form-label">Access Token</label>
                <textarea
                  v-model="editingToken.access_token"
                  class="form-control"
                  placeholder="请输入 Access Token"
                  rows="4"
                  required
                ></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">Portal URL（可选）</label>
                <input
                  type="url"
                  v-model="editingToken.portal_url"
                  class="form-control"
                  placeholder="请输入 Portal URL（可选）"
                >
              </div>
              <div class="mb-3">
                <label class="form-label">邮箱备注（可选）</label>
                <input
                  type="text"
                  v-model="editingToken.email_note"
                  class="form-control"
                  placeholder="请输入邮箱或备注信息（可选）"
                >
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn me-auto" @click="closeEditModal">
              <i class="bi bi-x-lg me-1"></i>
              取消
            </button>
            <button
              v-if="!isTokenShared(editingToken)"
              type="button"
              class="btn btn-indigo me-2"
              @click="shareToken(editingToken)"
            >
              <i class="bi bi-share me-1"></i>
              分享
            </button>

            <button type="button" class="btn btn-primary" @click="updateToken">
              <i class="bi bi-check-lg me-1"></i>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 分享信息查看模态框 -->
    <div v-if="showShareInfoModalFlag" class="modal modal-blur fade show" style="display: block;">
      <div class="modal-dialog modal-dialog-centered" role="document" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">分享信息</h5>
            <button type="button" class="btn-close" @click="closeShareInfoModal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info" role="alert">
              <div class="d-flex">
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 8h.01"/>
                    <path d="M11 12h1v4h1"/>
                  </svg>
                </div>
                <div>
                  <h4>Token已分享到公共池</h4>
                  <div class="text-muted">此Token已成功分享，用户可以使用激活码进行激活。</div>
                </div>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">激活码</label>
              <div class="input-group">
                <input
                  type="text"
                  class="form-control"
                  :value="getShareInfo(shareInfoToken)?.recharge_card || ''"
                  readonly
                >
                <button
                  class="btn btn-outline-secondary"
                  type="button"
                  @click="copyToClipboard(getShareInfo(shareInfoToken)?.recharge_card || '', '激活码')"
                >
                  <i class="bi bi-clipboard"></i>
                </button>
              </div>
            </div>

            <div v-if="getShareInfo(shareInfoToken)?.deactivation_code" class="mb-3">
              <label class="form-label">反激活码</label>
              <div class="input-group">
                <input
                  type="text"
                  class="form-control"
                  :value="getShareInfo(shareInfoToken)?.deactivation_code || ''"
                  readonly
                >
                <button
                  class="btn btn-outline-secondary"
                  type="button"
                  @click="copyToClipboard(getShareInfo(shareInfoToken)?.deactivation_code || '', '反激活码')"
                >
                  <i class="bi bi-clipboard"></i>
                </button>
              </div>
              <div class="form-text text-danger">
                <i class="bi bi-exclamation-triangle me-1"></i>
                反激活码请勿公开，仅用于重置激活码
              </div>
            </div>

            <div v-else class="mb-3">
              <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                此Token已存在于公共池中，无反激活码。如需重置激活码，请联系管理员。
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn me-auto" @click="closeShareInfoModal">
              <i class="bi bi-x-lg me-1"></i>
              关闭
            </button>
            <button
              v-if="getShareInfo(shareInfoToken)?.deactivation_code"
              type="button"
              class="btn btn-warning"
              @click="resetRechargeCard(shareInfoToken)"
            >
              <i class="bi bi-arrow-clockwise me-1"></i>
              重置激活码
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认模态框 -->
    <div v-if="showDeleteModal" class="modal modal-blur fade show" style="display: block;">
      <div class="modal-dialog modal-sm modal-dialog-centered" role="document" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">确认删除</h5>
            <button type="button" class="btn-close" @click="closeDeleteModal"></button>
          </div>
          <div class="modal-body">
            <p>确定要删除这个 Token 吗？</p>
            <div class="text-muted small">
              <strong>邮箱备注：</strong>{{ deletingToken?.email_note }}<br>
              <strong>创建时间：</strong>{{ deletingToken?.created_at }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn me-auto" @click="closeDeleteModal">
              <i class="bi bi-x-lg me-1"></i>
              取消
            </button>
            <button type="button" class="btn btn-danger" @click="confirmDelete">
              <i class="bi bi-trash-fill me-1"></i>
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Token验证确认模态框 -->
    <div v-if="showValidateConfirmModal" class="modal modal-blur fade show" style="display: block;">
      <div class="modal-dialog modal-sm modal-dialog-centered" role="document" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">确认验证</h5>
            <button type="button" class="btn-close" @click="closeValidateModal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning" role="alert">
              <div class="d-flex">
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M12 9v2m0 4v.01"/>
                    <path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"/>
                  </svg>
                </div>
                <div>
                  <h4 class="alert-title">验证 Token 状态可能会导致 Token 失效！</h4>
                  <div class="text-muted">请谨慎操作！</div>
                </div>
              </div>
            </div>
            <div class="text-muted small">
              <strong>邮箱备注：</strong>{{ validatingToken?.email_note }}<br>
              <strong>Tenant URL：</strong>{{ validatingToken?.tenant_url }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn me-auto" @click="closeValidateModal">
              <i class="bi bi-x-lg me-1"></i>
              取消
            </button>
            <button
              type="button"
              class="btn btn-warning"
              @click="confirmValidateToken"
            >
              <i class="bi bi-check-circle me-1"></i>
              确认验证
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Token重激活确认模态框 -->
    <div v-if="showReactivateModal" class="modal modal-blur fade show" style="display: block;">
      <div class="modal-dialog modal-sm modal-dialog-centered" role="document" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">重新激活Token</h5>
            <button type="button" class="btn-close" @click="closeReactivateModal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info" role="alert">
              <div class="d-flex">
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M12 8v4l3 3"/>
                    <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/>
                  </svg>
                </div>
                <div>
                  <h4 class="alert-title">重新激活失效的Token</h4>
                  <div class="text-muted">将使用原邮箱重新获取Token，不会生成新邮箱</div>
                </div>
              </div>
            </div>
            <div class="text-muted small">
              <strong>原邮箱：</strong>{{ reactivatingToken?.email_note || '无邮箱信息' }}<br>
              <strong>Tenant URL：</strong>{{ reactivatingToken?.tenant_url }}<br>
              <strong>创建时间：</strong>{{ reactivatingToken?.created_at }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn me-auto" @click="closeReactivateModal">
              <i class="bi bi-x-lg me-1"></i>
              取消
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="confirmReactivateToken"
              :disabled="isReactivating"
            >
              <i :class="['bi', 'me-1', isReactivating ? 'bi-arrow-clockwise refresh-spin' : 'bi-arrow-clockwise']"></i>
              {{ isReactivating ? '重激活中...' : '确认重激活' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 失效Token操作选择模态框 -->
    <div v-if="showInvalidTokenActionModal" class="modal modal-blur fade show" style="display: block;">
      <div class="modal-dialog modal-sm modal-dialog-centered" role="document" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">选择操作</h5>
            <button type="button" class="btn-close" @click="closeInvalidTokenActionModal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning" role="alert">
              <div class="d-flex">
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M12 9v2m0 4v.01"/>
                    <path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"/>
                  </svg>
                </div>
                <div>
                  <h4 class="alert-title">Token状态为失效</h4>
                  <div class="text-muted">请选择要执行的操作：</div>
                </div>
              </div>
            </div>
            <div class="mb-3">
              <strong>Token ID：</strong>{{ selectedInvalidToken?.id }}<br>
              <strong>Tenant URL：</strong>{{ selectedInvalidToken?.tenant_url }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn me-auto" @click="closeInvalidTokenActionModal">
              <i class="bi bi-x-lg me-1"></i>
              取消
            </button>
            <button
              type="button"
              class="btn btn-info me-2"
              @click="validateInvalidToken"
            >
              <i class="bi bi-shield-check me-1"></i>
              验证状态
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="reactivateInvalidToken"
            >
              <i class="bi bi-arrow-clockwise me-1"></i>
              重新激活
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量验证确认模态框 -->
    <div v-if="showBatchValidateModal" class="modal modal-blur fade show" style="display: block;">
      <div class="modal-dialog modal-sm modal-dialog-centered" role="document" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">确认批量验证</h5>
            <button type="button" class="btn-close" @click="closeBatchValidateModal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning" role="alert">
              <div class="d-flex">
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M12 9v2m0 4v.01"/>
                    <path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"/>
                  </svg>
                </div>
                <div>
                  <h4 class="alert-title">验证 Token 状态可能会导致 Token 失效！</h4>
                  <div class="text-muted">请谨慎操作！</div>
                </div>
              </div>
            </div>
            <div class="text-muted small">
              <strong>将要验证：</strong>{{ batchValidateResults.total }} 个Token
              <template v-if="isSelectMode">
                <span class="badge text-bg-primary ms-2">选中的Token</span>
              </template>
              <template v-else-if="activeFilter">
                <span class="badge text-bg-primary ms-2">{{ activeFilter }}</span>
              </template>
              <template v-else>
                <span class="badge text-bg-light ms-2">所有Token</span>
              </template><br>
              <strong>验证方式：</strong>逐个验证，避免服务器压力
            </div>
            <div v-if="isBatchValidating" class="mt-3">
              <div class="progress">
                <div
                  class="progress-bar progress-bar-striped progress-bar-animated"
                  role="progressbar"
                  :style="{ width: ((batchValidateResults.valid + batchValidateResults.invalid + batchValidateResults.failed) / batchValidateResults.total * 100) + '%' }"
                >
                  {{ batchValidateResults.valid + batchValidateResults.invalid + batchValidateResults.failed }} / {{ batchValidateResults.total }}
                </div>
              </div>
              <div class="text-center mt-2 small">
                有效: {{ batchValidateResults.valid }} | 失效: {{ batchValidateResults.invalid }} | 错误: {{ batchValidateResults.failed }}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn me-auto" @click="closeBatchValidateModal" :disabled="isBatchValidating">
              <i class="bi bi-x-lg me-1"></i>
              取消
            </button>
            <button
              type="button"
              class="btn btn-warning"
              @click="confirmBatchValidate"
              :disabled="isBatchValidating"
            >
              <i class="bi bi-check-circle me-1"></i>
              确认验证
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量刷新确认模态框 -->
    <div v-if="showBatchRefreshModal" class="modal modal-blur fade show" style="display: block;">
      <div class="modal-dialog modal-sm modal-dialog-centered" role="document" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">确认批量刷新</h5>
            <button type="button" class="btn-close" @click="closeBatchRefreshModal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info" role="alert">
              <div class="d-flex">
                <div>
                  <i class="bi bi-info-circle alert-icon" style="font-size: 24px;"></i>
                </div>
                <div>
                  <h4 class="alert-title">即将刷新账户的详细信息！</h4>
                  <div class="text-muted">此操作将获取最新的余额信息</div>
                </div>
              </div>
            </div>
            <div class="text-muted small">
              <strong>将要刷新：</strong>{{ isSelectMode ? selectedTokenIds.size : batchRefreshResults.total }} 个Token
              <template v-if="isSelectMode">
                <span class="badge text-bg-primary ms-2">选中的Token</span>
              </template>
              <template v-else-if="activeFilter">
                <span class="badge text-bg-primary ms-2">{{ activeFilter }}</span>
              </template>
              <template v-else>
                <span class="badge text-bg-light ms-2">全部状态</span>
              </template><br>
              <strong>刷新方式：</strong>批量刷新，获取最新状态信息
            </div>

            <!-- 刷新进度 -->
            <div v-if="isBatchRefreshing" class="mt-3">
              <div class="progress">
                <div
                  class="progress-bar progress-bar-striped progress-bar-animated"
                  role="progressbar"
                  :style="{ width: ((batchRefreshResults.success + batchRefreshResults.failed) / batchRefreshResults.total * 100) + '%' }"
                >
                  {{ batchRefreshResults.success + batchRefreshResults.failed }} / {{ batchRefreshResults.total }}
                </div>
              </div>
              <div class="text-center mt-2 small">
                成功: {{ batchRefreshResults.success }} | 失败: {{ batchRefreshResults.failed }}
              </div>
            </div>


          </div>
          <div class="modal-footer">
            <button type="button" class="btn me-auto" @click="closeBatchRefreshModal" :disabled="isBatchRefreshing">
              <i class="bi bi-x-lg me-1"></i>
              {{ isBatchRefreshing ? '刷新中...' : '取消' }}
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              @click="confirmBatchRefresh"
              :disabled="isBatchRefreshing"
            >
              <i class="bi bi-arrow-clockwise me-1"></i>
              确认刷新
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加 Token 模态框 -->
    <div v-if="showAddModal" class="modal modal-blur fade show" style="display: block;">
      <div class="modal-dialog modal-lg modal-dialog-centered" role="document" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">导入 Token</h5>
            <button type="button" class="btn-close" @click="closeAddModal"></button>
          </div>
          <div class="modal-body">
            <!-- 标签卡导航 -->
            <ul class="nav nav-tabs mb-3" role="tablist">
              <li class="nav-item" role="presentation">
                <button
                  class="nav-link"
                  :class="{ active: addTokenTab === 'single' }"
                  @click="addTokenTab = 'single'"
                  type="button"
                >
                  单个添加
                </button>
              </li>
              <li class="nav-item" role="presentation">
                <button
                  class="nav-link"
                  :class="{ active: addTokenTab === 'batch' }"
                  @click="addTokenTab = 'batch'"
                  type="button"
                >
                  批量导入
                </button>
              </li>
            </ul>

            <!-- 单个添加标签页 -->
            <div v-if="addTokenTab === 'single'">
              <form @submit.prevent="addSingleToken">
                <div class="mb-3">
                  <label class="form-label">Tenant URL</label>
                  <input
                    type="url"
                    v-model="singleToken.tenant_url"
                    class="form-control"
                    placeholder="请输入 Tenant URL"
                    required
                  >
                </div>
                <div class="mb-3">
                  <label class="form-label">Access Token</label>
                  <textarea
                    v-model="singleToken.access_token"
                    class="form-control"
                    placeholder="请输入 Access Token"
                    rows="4"
                    required
                  ></textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label">Portal URL（可选）</label>
                  <input
                    type="url"
                    v-model="singleToken.portal_url"
                    class="form-control"
                    placeholder="请输入 Portal URL（可选）"
                  >
                </div>
                <div class="mb-3">
                  <label class="form-label">邮箱备注（可选）</label>
                  <input
                    type="text"
                    v-model="singleToken.email_note"
                    class="form-control"
                    placeholder="请输入邮箱或备注信息（可选）"
                  >
                </div>
              </form>
            </div>

            <!-- 批量导入标签页 -->
            <div v-if="addTokenTab === 'batch'">
              <!-- 导入方式选择 -->
              <div class="mb-3">
                <label class="form-label">导入方式</label>
                <div class="form-selectgroup">
                  <label class="form-selectgroup-item">
                    <input
                      type="radio"
                      name="importType"
                      value="csv"
                      v-model="batchImport.type"
                      class="form-selectgroup-input"
                    >
                    <span class="form-selectgroup-label">CSV文件导入</span>
                  </label>
                  <label class="form-selectgroup-item">
                    <input
                      type="radio"
                      name="importType"
                      value="json"
                      v-model="batchImport.type"
                      class="form-selectgroup-input"
                    >
                    <span class="form-selectgroup-label">JSON文本导入</span>
                  </label>
                </div>
              </div>

              <!-- CSV文件导入 -->
              <div v-if="batchImport.type === 'csv'">
                <div class="mb-3">
                  <label class="form-label">CSV文件</label>
                  <div
                    class="dropzone"
                    :class="{ 'dropzone-dragover': isDragOver }"
                    @drop="handleFileDrop"
                    @dragover.prevent="isDragOver = true"
                    @dragleave="isDragOver = false"
                    @click="csvFileInput?.click()"
                  >
                    <div class="dropzone-content">
                      <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-lg text-muted mb-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M14 3v4a1 1 0 0 0 1 1h4"/>
                        <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/>
                        <path d="M9 9l1 0"/>
                        <path d="M9 13l6 0"/>
                        <path d="M9 17l6 0"/>
                      </svg>
                      <div v-if="!batchImport.csvFile">
                        <p class="mb-1">点击选择文件或拖拽文件到此处</p>
                        <p class="text-muted small">支持 .csv 格式文件</p>
                      </div>
                      <div v-else>
                        <p class="mb-1 text-success">{{ batchImport.csvFile.name }}</p>
                        <p class="text-muted small">{{ formatFileSize(batchImport.csvFile.size) }}</p>
                      </div>
                    </div>
                  </div>
                  <input
                    ref="csvFileInput"
                    type="file"
                    accept=".csv"
                    @change="handleFileSelect"
                    style="display: none;"
                  >
                </div>
              </div>

              <!-- JSON文本导入 -->
              <div v-if="batchImport.type === 'json'">
                <div class="mb-3">
                  <label class="form-label">JSON 数据</label>
                  <textarea
                    v-model="batchImport.jsonData"
                    class="form-control"
                    placeholder="{
    &quot;tenant_url&quot;: &quot;https://example.api.augmentcode.com/&quot;,
    &quot;access_token&quot;: &quot;random_string&quot;,
    &quot;portal_url&quot;: &quot;https://portal.withorb.com/view?token=another_token_here&quot;
    &quot;email_note&quot;: &quot;your_email@example.com&quot;
}"
                    rows="8"
                  ></textarea>
                  <div class="form-hint">
                    <br><strong>必填字段：</strong>tenant_url、access_token
                    <br><strong>可选字段：</strong>portal_url、email_note
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn me-auto" @click="closeAddModal">
              <i class="bi bi-x-lg me-1"></i>
              取消
            </button>
            <button
              v-if="addTokenTab === 'single'"
              type="button"
              class="btn btn-primary"
              @click="addSingleToken"
            >
              <i class="bi bi-plus-lg me-1"></i>
              添加
            </button>
            <button
              v-if="addTokenTab === 'batch'"
              type="button"
              class="btn btn-primary"
              @click="importBatchTokens"
              :disabled="!canImport"
            >
              <i class="bi bi-upload me-1"></i>
              导入
            </button>
          </div>
        </div>
      </div>
    </div>

  <!-- 执行Token模态框 -->
  <div v-if="showExecuteModal" class="modal modal-blur fade show" style="display: block;" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-play-circle me-2"></i>
            选择应用程序
          </h5>
          <button type="button" class="btn-close" @click="showExecuteModal = false"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <div class="text-muted small">
              Token: {{ currentExecuteToken?.email_note || '未命名Token' }}
            </div>
          </div>

          <div class="row g-3">
            <div
              v-for="app in applications"
              :key="app.name"
              class="col-6 col-md-4"
            >
              <div
                class="card card-link cursor-pointer app-card"
                :class="{ 'disabled': isExecuting }"
                @click="executeApplication(app)"
              >
                <div class="card-body text-center p-3">
                  <div class="app-icon mb-2">
                    <div v-if="isExecuting" class="spinner-border spinner-border-sm text-primary" role="status">
                      <span class="visually-hidden">Loading...</span>
                    </div>
                    <img
                      v-else
                      :src="getIconUrl(app.icon)"
                      :alt="app.name"
                      class="app-icon-img"
                    >
                  </div>
                  <div class="app-name">{{ app.name }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="showExecuteModal = false">
            <i class="bi bi-x-lg me-1"></i>
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { toast } from '../utils/toast'
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api'



interface Token {
  id: string
  tenant_url: string
  access_token: string
  portal_url: string
  email_note: string
  ban_status: string
  portal_info: string
  created_at: string
  updated_at: string
  share_info?: string
  is_shared?: boolean
}

interface PortalInfo {
  is_active: boolean
  expiry_date: string
  credits_balance: number
  tenant_url?: string
  portal_url?: string
}

interface TokenResponse {
  data: Token[]
  pagination: {
    has_next: boolean
    has_prev: boolean
    limit: number
    page: number
    total: number
    total_pages: number
  }
  success: boolean
}

interface NewToken {
  email: string
  token: string
}

interface SingleToken {
  id?: number
  tenant_url: string
  access_token: string
  portal_url: string
  email_note: string
}

interface BatchImport {
  type: 'csv' | 'json'
  csvFile: File | null
  jsonData: string
}

// 响应式数据
const allTokens = ref<Token[]>([]) // 存储所有Token数据
const tokens = ref<Token[]>([]) // 当前页显示的Token数据
const pagination = ref({
  has_next: false,
  has_prev: false,
  limit: 12,
  page: 1,
  total: 0,
  total_pages: 0
})
const isLoading = ref(false)
const showGetModal = ref(false)
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const showShareInfoModalFlag = ref(false)
const shareInfoToken = ref<Token | null>(null)
const showValidateConfirmModal = ref(false)
const validatingToken = ref<Token | null>(null)
const isValidating = ref(false)
const refreshingToken = ref<Token | null>(null)
const isRefreshing = ref(false)

// 视图模式 - 从本地存储读取，默认为卡片视图
const viewMode = ref<'card' | 'table'>(
  (localStorage.getItem('token-manager-view-mode') as 'card' | 'table') || 'card'
)

// 监听视图模式变化，保存到本地存储
watch(viewMode, (newMode) => {
  localStorage.setItem('token-manager-view-mode', newMode)
}, { immediate: false })

// 排序状态管理 - 默认按过期时间升序排序
const sortField = ref<string | null>('expiry_date')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 批量选择状态管理
const selectedTokenIds = ref<Set<string>>(new Set())
const isSelectMode = ref(false)

// 执行模态框状态
const showExecuteModal = ref(false)
const currentExecuteToken = ref<Token | null>(null)
const isExecuting = ref(false)
const showBatchValidateModal = ref(false)
const isBatchValidating = ref(false)
const batchValidateResults = ref({
  valid: 0,
  invalid: 0,
  failed: 0,
  total: 0
})

// 批量刷新模态框状态
const showBatchRefreshModal = ref(false)
const isBatchRefreshing = ref(false)
const batchRefreshResults = ref({
  success: 0,
  failed: 0,
  total: 0
})
const isGeneratingUrl = ref(false)
const lastGenerateTime = ref(0)
const generateCooldown = 10000 // 10秒冷却时间
const currentTime = ref(Date.now()) // 当前时间，用于触发响应式更新

// 计算生成按钮是否在冷却中
const isGenerateOnCooldown = computed(() => {
  if (lastGenerateTime.value === 0) return false
  return currentTime.value - lastGenerateTime.value < generateCooldown
})

// 计算剩余冷却时间
const remainingCooldownTime = computed(() => {
  if (!isGenerateOnCooldown.value) return 0
  return Math.ceil((generateCooldown - (currentTime.value - lastGenerateTime.value)) / 1000)
})

// 计算是否为重激活模式
const isReactivateMode = computed(() => {
  return generatedEmail.value && reactivatingToken.value !== null
})

// 定时器更新当前时间
let cooldownTimer: number | null = null

const startCooldownTimer = () => {
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    currentTime.value = Date.now()
    // 如果冷却结束，清除定时器
    if (!isGenerateOnCooldown.value) {
      if (cooldownTimer) {
        clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    }
  }, 1000)
}

const stopCooldownTimer = () => {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
}
const authResponseError = ref('')
const isValidatingResponse = ref(false)
const tokenData = ref({
  tenant_url: '',
  access_token: '',
  portal_url: ''
})
const emailNote = ref('')
const isSavingToken = ref(false)

// 邮箱生成相关数据
const generatedEmail = ref('')
const emailDomains = ref<string[]>([])
const selectedDomain = ref('')
const customDomain = ref('')
const emailType = ref('mixed')
const emailPrefix = ref('')
const emailLength = ref(10)
const isGeneratingEmail = ref(false)
const verificationCode = ref('')
const verificationEmail = ref('')
const verificationTimestamp = ref('')
const isGettingVerificationCode = ref(false)
const autoRefreshVerificationCode = ref(false)
const verificationRefreshTimer = ref<number | null>(null)
const lastVerificationCode = ref('')  // 记录上次获取的验证码

// 重激活相关数据
const showReactivateModal = ref(false)
const reactivatingToken = ref<Token | null>(null)
const isReactivating = ref(false)

// 失效Token操作选择
const showInvalidTokenActionModal = ref(false)
const selectedInvalidToken = ref<Token | null>(null)

const newToken = ref<NewToken>({
  email: '',
  token: ''
})
const editingToken = ref<{
  id?: string
  tenant_url: string
  access_token: string
  portal_url: string
  email_note: string
}>({
  tenant_url: '',
  access_token: '',
  portal_url: '',
  email_note: ''
})
const deletingToken = ref<Token | null>(null)

// 筛选相关
const activeFilter = ref<string | null>(null) // 当前激活的筛选器

// 状态统计计算属性
const statusStats = computed(() => {
  const stats = {
    normal: 0,
    invalid: 0,
    banned: 0,
    expired: 0,
    exhausted: 0,
    unknown: 0
  }

  allTokens.value.forEach(token => {
    const status = getTokenStatus(token)
    switch (status) {
      case '正常':
        stats.normal++
        break
      case '失效':
        stats.invalid++
        break
      case '封禁':
        stats.banned++
        break
      case '过期':
        stats.expired++
        break
      case '燃尽':
        stats.exhausted++
        break
      case '未知':
        stats.unknown++
        break
    }
  })

  return stats
})

// 已分享Token计数
const sharedTokensCount = computed(() => {
  return allTokens.value.filter(token => isTokenShared(token)).length
})

// 获取Token流程相关数据
const getTokenStep = ref(1)
const authUrl = ref('')
const authResponse = ref('')
const portalUrl = ref('')
const obtainedToken = ref('')
const isGettingToken = ref(false)
const codeChallenge = ref('')
const codeVerifier = ref('')
const state = ref('')

// 添加Token相关数据
const addTokenTab = ref<'single' | 'batch'>('batch')
const singleToken = ref({
  tenant_url: '',
  access_token: '',
  portal_url: '',
  email_note: ''
})
const batchImport = ref<BatchImport>({
  type: 'json',
  csvFile: null,
  jsonData: ''
})
const isDragOver = ref(false)
const csvFileInput = ref<HTMLInputElement | null>(null)


// 计算属性
const canImport = computed(() => {
  if (batchImport.value.type === 'csv') {
    return batchImport.value.csvFile !== null
  } else {
    return batchImport.value.jsonData.trim() !== ''
  }
})

// 生命周期
onMounted(async () => {
  // 检查认证状态
  const token = localStorage.getItem('auth_token')
  if (!token) {
    // 没有token，跳转到登录页
    window.location.href = '/login'
    return
  }

  // 有token，尝试加载数据
  await loadTokens()
})

onUnmounted(() => {
  stopCooldownTimer()
})

// 方法
const loadTokens = async (page: number = 1) => {
  // 如果已经有数据，只需要更新分页显示
  if (allTokens.value.length > 0) {
    updatePagination(page)
    return
  }

  isLoading.value = true
  try {
    // 一次性加载所有数据
    const response = await apiGet(`/api/tokens?limit=10000`)

    // 检查认证错误
    if (response.status === 401) {
      // 认证失败，清除token并跳转到登录页
      localStorage.removeItem('auth_token')
      localStorage.removeItem('username')
      window.location.href = '/login'
      return
    }

    const data: TokenResponse = await response.json()

    if (data.success) {
      allTokens.value = data.data
      updatePagination(page)
    } else {
      toast.error('获取Token列表失败')
    }
  } catch (error) {
    console.error('获取Token列表失败:', error)
    toast.error('网络错误，请重试')
  } finally {
    isLoading.value = false
  }
}

// 获取筛选和排序后的Token数据
const getFilteredTokens = () => {
  let filteredTokens = allTokens.value

  // 应用筛选
  if (activeFilter.value) {
    filteredTokens = filteredTokens.filter(token => {
      if (activeFilter.value === '已分享') {
        return isTokenShared(token)
      }

      const status = getTokenStatus(token)
      if (activeFilter.value === '不可用') {
        return status === '封禁' || status === '燃尽' || status === '过期'
      }
      return status === activeFilter.value
    })
  }

  // 应用排序
  if (sortField.value) {
    filteredTokens = [...filteredTokens].sort((a, b) =>
      compareTokens(a, b, sortField.value!, sortOrder.value)
    )
  }

  return filteredTokens
}

// 更新前端分页显示
const updatePagination = (page: number) => {
  const filteredTokens = getFilteredTokens()
  const total = filteredTokens.length
  const limit = pagination.value.limit
  const totalPages = Math.ceil(total / limit) || 1

  // 确保页码在有效范围内
  const currentPage = Math.max(1, Math.min(page, totalPages))

  // 计算当前页的数据范围
  const startIndex = (currentPage - 1) * limit
  const endIndex = Math.min(startIndex + limit, total)

  // 更新显示的Token数据
  tokens.value = filteredTokens.slice(startIndex, endIndex)

  // 更新分页信息
  pagination.value = {
    has_next: currentPage < totalPages,
    has_prev: currentPage > 1,
    limit: limit,
    page: currentPage,
    total: total,
    total_pages: totalPages
  }
}

// 切换筛选器
const toggleFilter = (status: string) => {
  if (activeFilter.value === status) {
    // 如果点击的是当前激活的筛选器，则取消筛选
    activeFilter.value = null
  } else {
    // 否则设置新的筛选器
    activeFilter.value = status
  }

  // 重新计算分页，回到第一页
  updatePagination(1)
}

// 刷新数据（重新从服务器加载）
const refreshTokens = async () => {
  allTokens.value = [] // 清空缓存
  activeFilter.value = null // 清空筛选
  sortField.value = null // 清空排序
  await loadTokens(1) // 重新加载第一页
}

// 排序功能
const sortTokens = (field: string) => {
  if (sortField.value === field) {
    // 如果点击的是当前排序字段，切换排序方向或清除排序
    if (sortOrder.value === 'asc') {
      sortOrder.value = 'desc'
    } else {
      // 从降序回到无排序状态
      sortField.value = null
      sortOrder.value = 'asc'
    }
  } else {
    // 点击新字段，设置为升序
    sortField.value = field
    sortOrder.value = 'asc'
  }

  // 排序后回到第一页
  updatePagination(1)
}

// Token比较函数
const compareTokens = (a: Token, b: Token, field: string, order: 'asc' | 'desc'): number => {
  // 获取token状态
  const aStatus = getTokenStatus(a)
  const bStatus = getTokenStatus(b)

  // 定义状态优先级：(正常|失效) > 未知 > 不可用
  const getStatusPriority = (status: string): number => {
    if (status === '正常' || status === '失效') return 1
    if (status === '未知') return 2
    if (status === '不可用') return 3
    return 4 // 其他状态
  }

  const aPriority = getStatusPriority(aStatus)
  const bPriority = getStatusPriority(bStatus)

  // 如果状态优先级不同，按优先级排序
  if (aPriority !== bPriority) {
    return aPriority - bPriority
  }

  // 如果都是不可用状态，保持原顺序（不排序）
  if (aPriority === 3 && bPriority === 3) return 0

  let aValue: any
  let bValue: any

  if (field === 'expiry_date') {
    // 过期时间排序
    const aPortalInfo = parsePortalInfo(a.portal_info)
    const bPortalInfo = parsePortalInfo(b.portal_info)

    aValue = aPortalInfo?.expiry_date ? new Date(aPortalInfo.expiry_date).getTime() : 0
    bValue = bPortalInfo?.expiry_date ? new Date(bPortalInfo.expiry_date).getTime() : 0
  } else if (field === 'credits_balance') {
    // 剩余次数排序
    const aPortalInfo = parsePortalInfo(a.portal_info)
    const bPortalInfo = parsePortalInfo(b.portal_info)

    aValue = aPortalInfo?.credits_balance ?? 0
    bValue = bPortalInfo?.credits_balance ?? 0
  }

  // 处理相等情况
  if (aValue === bValue) return 0

  // 升序或降序
  const result = aValue < bValue ? -1 : 1
  return order === 'asc' ? result : -result
}

// 辅助函数
const parsePortalInfo = (portalInfoStr: string): PortalInfo | null => {
  try {
    return JSON.parse(portalInfoStr)
  } catch {
    return null
  }
}

// 计算剩余天数和小时数
const calculateRemainingTime = (token: Token): { days: number, hours: number, totalDays: number } => {
  const portalInfo = parsePortalInfo(token.portal_info)
  if (!portalInfo || !portalInfo.expiry_date) return { days: 0, hours: 0, totalDays: 0 }

  const expiryDate = new Date(portalInfo.expiry_date)
  if (isNaN(expiryDate.getTime())) return { days: 0, hours: 0, totalDays: 0 }

  const now = new Date()
  const diffTime = expiryDate.getTime() - now.getTime()

  if (diffTime <= 0) return { days: 0, hours: 0, totalDays: 0 }

  const totalHours = Math.floor(diffTime / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return { days, hours, totalDays }
}

// 格式化剩余时间显示
const formatRemainingTime = (token: Token): string => {
  const timeInfo = calculateRemainingTime(token)
  if (timeInfo.totalDays === 0) return '-'

  if (timeInfo.days === 0) {
    return `${timeInfo.hours}小时`
  } else if (timeInfo.hours === 0) {
    return `${timeInfo.days}天`
  } else {
    return `${timeInfo.days}天${timeInfo.hours}小时`
  }
}

// 获取过期时间显示
const getExpiryDate = (token: Token): string => {
  const portalInfo = parsePortalInfo(token.portal_info)
  if (!portalInfo || !portalInfo.expiry_date) {
    return '-'
  }

  try {
    const expiryDate = new Date(portalInfo.expiry_date)
    if (isNaN(expiryDate.getTime())) {
      return '-'
    }

    return expiryDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return '-'
  }
}

const calculateDaysUntilExpiry = (expiryDate: string): number => {
  if (!expiryDate) return 0

  const expiry = new Date(expiryDate)
  if (isNaN(expiry.getTime())) return 0

  const now = new Date()
  const diffTime = expiry.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

const getRemainingDays = (token: Token): string => {
  const portalInfo = parsePortalInfo(token.portal_info)
  if (!portalInfo || !portalInfo.expiry_date) return '-'
  const days = calculateDaysUntilExpiry(portalInfo.expiry_date)
  return isNaN(days) ? '-' : days.toString()
}

const getRemainingCredits = (token: Token): string => {
  const portalInfo = parsePortalInfo(token.portal_info)
  if (!portalInfo || portalInfo.credits_balance === undefined) return '-'
  return portalInfo.credits_balance.toString()
}

const getTokenStatus = (token: Token): '正常' | '失效' | '封禁' | '过期' | '燃尽' | '未知' => {

  // 解析portal_info获取余额和过期时间
  const portalInfo = parsePortalInfo(token.portal_info)

  // 优先级1: 过期状态（过期时间 < 当前时间）
  if (portalInfo && portalInfo.expiry_date) {
    const expiryDate = new Date(portalInfo.expiry_date)
    if (!isNaN(expiryDate.getTime()) && expiryDate < new Date()) {
      return '过期'
    }
  }

  // 优先级2: 燃尽状态（余额为0）
  if (portalInfo && portalInfo.credits_balance === 0) {
    return '燃尽'
  }

  // 优先级3-5: 根据ban_status判断
  if (token.ban_status) {
    try {
      const banStatusObj = JSON.parse(token.ban_status)
      if (banStatusObj && banStatusObj.status) {
        switch (banStatusObj.status) {
          case 'NORMAL':
            return '正常'
          case 'INVALID':
            return '失效'
          case 'BANNED':
            return '封禁'
          case 'EXPIRED':
            return '过期'
          case 'EXHAUSTED':
            return '燃尽'
          default:
            return '未知'
        }
      }
    } catch (e) {
      // 兼容旧格式
      if (token.ban_status === '{}') {
        return '正常'
      }
      if (token.ban_status === '"ACTIVE"') {
        return '失效'
      }
    }
  }

  // 如果状态为null或无法解析，返回未知
  return '未知'
}

// 获取状态配色类
const getStatusColorClass = (status: string): string => {
  switch (status) {
    case '正常':
      return 'text-success'
    case '失效':
      return 'text-danger'
    case '封禁':
      return 'text-danger'
    case '过期':
      return 'text-warning'
    case '燃尽':
      return 'text-muted'
    case '未知':
      return 'text-secondary'
    default:
      return 'text-muted'
  }
}

// 获取剩余时间的配色类
const getDaysColorClass = (token: Token): string => {
  const timeInfo = calculateRemainingTime(token)
  if (timeInfo.totalDays === 0) return 'text-muted'

  if (timeInfo.totalDays > 5) return 'text-success'
  if (timeInfo.totalDays > 2) return 'text-warning'
  return 'text-danger'
}

// 获取剩余次数的配色类
const getCreditsColorClass = (token: Token): string => {
  const credits = getRemainingCredits(token)
  if (credits === '-') return 'text-muted'

  const creditsNum = parseInt(credits)
  if (isNaN(creditsNum)) return 'text-muted'

  if (creditsNum > 30) return 'text-success'
  if (creditsNum >= 10) return 'text-warning'
  return 'text-danger' // 小于10次
}

const getTokenStatusClass = (token: Token): string => {
  const status = getTokenStatus(token)
  switch (status) {
    case '正常':
      return 'bg-success text-white'
    case '失效':
      return 'bg-warning-subtle text-warning-emphasis'  // 失效改为淡黄色
    case '封禁':
      return 'bg-danger text-white'   // 封禁保持红色
    case '过期':
      return 'bg-warning text-dark'
    case '燃尽':
      return 'bg-warning text-dark'
    case '未知':
      return 'bg-secondary text-white'
    default:
      return 'bg-secondary text-white'
  }
}

const getPageNumbers = (): number[] => {
  const pages: number[] = []
  const totalPages = pagination.value.total_pages
  const currentPage = pagination.value.page

  // 显示当前页前后2页
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(totalPages, currentPage + 2)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
}

// 注意：随机字符串生成已移至后端API

// 验证授权响应并进入下一步
const validateAndNextStep = async () => {
  if (!authResponse.value || authResponseError.value) {
    return
  }

  isValidatingResponse.value = true

  try {
    const authResponseData = JSON.parse(authResponse.value)

    const payload = {
      auth_response: authResponseData,
      oauth_state: {
        auth_url: authUrl.value,
        code_challenge: codeChallenge.value,
        code_verifier: codeVerifier.value,
        creation_time: Date.now(),
        state: state.value
      }
    }

    const response = await apiPost('/api/auth/validate-response', payload)

    const data = await response.json()

    if (data.success && data.data?.access_token) {
      // 保存Token数据，重新激活模式下使用原portal_url
      tokenData.value = {
        tenant_url: data.data.tenant_url || '',
        access_token: data.data.access_token || '',
        portal_url: isReactivateMode.value && reactivatingToken.value
          ? reactivatingToken.value.portal_url
          : (portalUrl.value || data.data.portal_url || '')
      }

      // 如果有生成的邮箱或OAuth返回的邮箱，自动填入邮箱备注
      if (data.data.email) {
        emailNote.value = data.data.email
      } else if (generatedEmail.value) {
        emailNote.value = generatedEmail.value
      }

      // 进入第三步
      getTokenStep.value = 3
      toast.success(data.message || '授权验证成功')
    } else {
      toast.error(data.error || data.message || '授权验证失败')
    }
  } catch (error) {
    console.error('授权验证失败:', error)
    toast.error('网络错误，请重试')
  } finally {
    isValidatingResponse.value = false
  }
}

// 保存Token
const saveToken = async () => {
  if (!tokenData.value.tenant_url || !tokenData.value.access_token) {
    toast.error('Token数据不完整')
    return
  }

  isSavingToken.value = true

  try {
    const payload: any = {
      tenant_url: tokenData.value.tenant_url,
      access_token: tokenData.value.access_token,
      portal_url: isReactivateMode.value && reactivatingToken.value
        ? reactivatingToken.value.portal_url
        : tokenData.value.portal_url,
      email_note: emailNote.value
    }

    // 重新激活时设置状态为正常
    if (isReactivateMode.value) {
      payload.ban_status = JSON.stringify({ status: 'NORMAL' })
    }

    let response
    let successMessage = 'Token保存成功'

    // 检查是否为重新激活模式
    if (isReactivateMode.value && reactivatingToken.value) {
      // 重新激活模式：更新现有Token
      response = await apiPut(`/api/tokens/${reactivatingToken.value.id}`, payload)
      successMessage = 'Token重新激活成功'
    } else {
      // 普通模式：创建新Token
      response = await apiPost('/api/tokens', payload)
    }

    const data = await response.json()

    if (data.success) {
      toast.success(data.message || successMessage)

      // 关闭模态框并刷新Token列表
      showGetModal.value = false
      refreshTokens()

      // 清除重新激活状态
      reactivatingToken.value = null
    } else {
      toast.error(data.error || data.message || 'Token保存失败')
    }
  } catch (error) {
    console.error('Token保存失败:', error)
    toast.error('网络错误，请重试')
  } finally {
    isSavingToken.value = false
  }
}

// 授权响应校验
const validateAuthResponse = () => {
  authResponseError.value = ''

  if (!authResponse.value.trim()) {
    return
  }

  try {
    const parsed = JSON.parse(authResponse.value)

    // 检查必需的字段
    const requiredFields = ['code', 'state', 'tenant_url']
    const missingFields = requiredFields.filter(field => !parsed[field])

    if (missingFields.length > 0) {
      authResponseError.value = `缺少必需字段: ${missingFields.join(', ')}`
      return
    }

    // 检查tenant_url格式
    if (parsed.tenant_url && !parsed.tenant_url.match(/^https?:\/\/.+/)) {
      authResponseError.value = 'tenant_url 必须是有效的HTTP/HTTPS URL'
      return
    }

    // 校验通过
    authResponseError.value = ''
  } catch (error) {
    authResponseError.value = '无效的JSON格式'
  }
}

const formatDateTime = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 批量选择相关函数
const toggleSelectMode = () => {
  isSelectMode.value = !isSelectMode.value
  if (!isSelectMode.value) {
    selectedTokenIds.value.clear()
  }
}

const toggleTokenSelection = (tokenId: string) => {
  if (selectedTokenIds.value.has(tokenId)) {
    selectedTokenIds.value.delete(tokenId)
  } else {
    selectedTokenIds.value.add(tokenId)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedTokenIds.value.clear()
  } else {
    tokens.value.forEach(token => {
      selectedTokenIds.value.add(token.id)
    })
  }
}

const isAllSelected = computed(() => {
  return tokens.value.length > 0 && tokens.value.every(token => selectedTokenIds.value.has(token.id))
})

const validateSelectedTokens = () => {
  if (selectedTokenIds.value.size === 0) {
    toast.error('请先选择要验证的Token')
    return
  }

  // 获取选中的token（所有选中的都可以验证）
  const selectedTokens = tokens.value.filter(token => selectedTokenIds.value.has(token.id))

  if (selectedTokens.length === 0) {
    toast.error('请先选择要验证的Token')
    return
  }

  // 重置验证结果
  batchValidateResults.value = {
    valid: 0,
    invalid: 0,
    failed: 0,
    total: selectedTokens.length
  }

  showBatchValidateModal.value = true
}

const refreshSelectedTokens = () => {
  if (selectedTokenIds.value.size === 0) {
    toast.error('请先选择要刷新的Token')
    return
  }

  // 获取选中的token
  const selectedTokens = tokens.value.filter(token => selectedTokenIds.value.has(token.id))

  // 筛选出有portal_url的Token（只有这些Token可以刷新）
  const refreshableTokens = selectedTokens.filter(token => token.portal_url && token.portal_url.trim() !== '')

  if (refreshableTokens.length === 0) {
    toast.info('选中的Token中没有可刷新的（只有设置了Portal URL的Token可以刷新）')
    return
  }

  showBatchRefreshModal.value = true
}

const validateAllTokens = () => {
  if (tokens.value.length === 0) {
    toast.error('没有Token需要验证')
    return
  }

  if (tokens.value.length === 0) {
    toast.error('没有Token需要验证')
    return
  }

  // 重置验证结果
  batchValidateResults.value = {
    valid: 0,
    invalid: 0,
    failed: 0,
    total: tokens.value.length
  }

  showBatchValidateModal.value = true
}

// 显示批量刷新确认模态框
const showBatchRefreshConfirm = () => {
  if (tokens.value.length === 0) {
    toast.error('没有Token需要刷新')
    return
  }

  // 筛选出有portal_url的Token（只有这些Token可以刷新）
  const refreshableTokens = tokens.value.filter(token => token.portal_url && token.portal_url.trim() !== '')

  if (refreshableTokens.length === 0) {
    toast.info('没有可刷新的Token（需要有portal_url）')
    return
  }

  // 重置刷新结果
  batchRefreshResults.value = {
    success: 0,
    failed: 0,
    total: refreshableTokens.length
  }

  showBatchRefreshModal.value = true
}



const showGetTokenModal = (isReactivate = false) => {
  // 强制清空所有可能残留的重激活状态
  if (!isReactivate) {
    reactivatingToken.value = null
    generatedEmail.value = ''
    emailNote.value = ''
  }

  // 重置获取Token流程数据
  getTokenStep.value = 1
  authUrl.value = ''
  authResponse.value = ''
  portalUrl.value = ''
  obtainedToken.value = ''
  isGettingToken.value = false
  codeChallenge.value = ''
  codeVerifier.value = ''
  state.value = ''
  authResponseError.value = ''
  isValidatingResponse.value = false
  tokenData.value = {
    tenant_url: '',
    access_token: '',
    email: '',
    portal_url: ''
  }
  emailNote.value = ''
  isSavingToken.value = false
  lastGenerateTime.value = 0  // 重置冷却时间
  currentTime.value = Date.now()
  stopCooldownTimer()  // 停止定时器

  // 重置邮箱生成相关数据
  if (!isReactivate) {
    // 新建模式：清空所有邮箱相关数据
    generatedEmail.value = ''
    reactivatingToken.value = null
  }
  // 重激活模式：保留generatedEmail，但清空其他数据

  selectedDomain.value = ''
  customDomain.value = ''
  emailType.value = 'mixed'
  emailPrefix.value = ''
  emailLength.value = 10

  // 验证码相关数据总是清空，每次都重新获取
  verificationCode.value = ''
  verificationEmail.value = ''
  verificationTimestamp.value = ''
  lastVerificationCode.value = ''
  autoRefreshVerificationCode.value = false
  stopVerificationRefresh()

  showGetModal.value = true
}

const closeGetModal = () => {
  showGetModal.value = false
  // 清除重激活状态
  reactivatingToken.value = null
  // 清除验证码缓存
  verificationCode.value = ''
  verificationEmail.value = ''
  verificationTimestamp.value = ''
  lastVerificationCode.value = ''
  autoRefreshVerificationCode.value = false
  stopVerificationRefresh()
}

const generateAuthUrl = async () => {
  // 检查冷却时间
  if (isGenerateOnCooldown.value) {
    toast.error(`请等待 ${remainingCooldownTime.value} 秒后再试`)
    return
  }

  isGeneratingUrl.value = true

  try {
    const response = await apiGet('/api/auth/generate-url')

    const data = await response.json()

    if (data.success) {
      // 提取授权URL到输入框
      authUrl.value = data.data.auth_url

      // 保存其他参数供后续使用
      codeChallenge.value = data.data.code_challenge
      codeVerifier.value = data.data.code_verifier
      state.value = data.data.state

      // 记录生成时间，开始冷却
      lastGenerateTime.value = Date.now()
      currentTime.value = Date.now()
      startCooldownTimer()

      toast.success(data.message || '授权URL生成成功')
    } else {
      toast.error(data.error || data.message || '授权URL生成失败')
    }
  } catch (error) {
    console.error('生成授权URL失败:', error)
    toast.error('网络错误，请重试')
  } finally {
    isGeneratingUrl.value = false
  }
}

const copyAuthUrl = async () => {
  try {
    await navigator.clipboard.writeText(authUrl.value)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

const openAuthUrl = () => {
  if (authUrl.value) {
    window.open(authUrl.value, '_blank')
  }
}

const nextStep = () => {
  if (getTokenStep.value < 3) {
    getTokenStep.value++
  }
}

const prevStep = () => {
  if (getTokenStep.value > 1) {
    getTokenStep.value--
  }
}



const copyToken = async () => {
  try {
    await navigator.clipboard.writeText(obtainedToken.value)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

const completeGetToken = () => {
  closeGetModal()
}

const showAddTokenModal = () => {
  // 重置添加Token数据
  addTokenTab.value = 'batch'
  singleToken.value = {
    tenant_url: '',
    access_token: '',
    portal_url: '',
    email_note: ''
  }
  batchImport.value = {
    type: 'json',
    csvFile: null,
    jsonData: ''
  }
  isDragOver.value = false
  newToken.value = { email: '', token: '' }
  showAddModal.value = true
}

const closeAddModal = () => {
  showAddModal.value = false
  // 重置表单
  singleToken.value = {
    tenant_url: '',
    access_token: '',
    portal_url: '',
    email_note: ''
  }
  addTokenTab.value = 'batch'
}

const addSingleToken = async () => {
  if (!singleToken.value.tenant_url || !singleToken.value.access_token) {
    toast.error('Tenant URL 和 Access Token 不能为空')
    return
  }

  try {
    const response = await apiPost('/api/tokens', {
      tenant_url: singleToken.value.tenant_url,
      access_token: singleToken.value.access_token,
      portal_url: singleToken.value.portal_url,
      email_note: singleToken.value.email_note
    })

    const data = await response.json()

    if (data.success) {
      // 添加到本地列表顶部
      tokens.value.unshift(data.data)

      // 重置表单
      singleToken.value = {
        tenant_url: '',
        access_token: '',
        portal_url: '',
        email_note: ''
      }

      toast.success(data.message || 'Token 添加成功')
      closeAddModal()
    } else {
      toast.error(data.error || data.message || 'Token 添加失败')
    }
  } catch (error) {
    console.error('添加Token失败:', error)
    toast.error('网络错误，请重试')
  }
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    batchImport.value.csvFile = target.files[0]
  }
}

const handleFileDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false

  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    const file = event.dataTransfer.files[0]
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      batchImport.value.csvFile = file
    }
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 验证URL格式
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// 验证Token数据格式
const validateTokenData = (tokenData: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (!tokenData.tenant_url) {
    errors.push('tenant_url字段必须存在')
  } else if (!isValidUrl(tokenData.tenant_url)) {
    errors.push('tenant_url必须是有效的URL格式')
  }

  if (!tokenData.access_token) {
    errors.push('access_token字段必须存在')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

const importBatchTokens = async () => {
  if (batchImport.value.type === 'csv' && batchImport.value.csvFile) {
    toast.info('CSV导入功能暂未实现')
    return
  } else if (batchImport.value.type === 'json' && batchImport.value.jsonData) {
    try {
      // 解析JSON数据
      const parsedData = JSON.parse(batchImport.value.jsonData)

      // 兼容单条对象和数组格式
      let jsonTokens: any[]
      if (Array.isArray(parsedData)) {
        jsonTokens = parsedData
      } else if (typeof parsedData === 'object' && parsedData !== null) {
        jsonTokens = [parsedData]
      } else {
        toast.error('JSON数据必须是对象或对象数组格式')
        return
      }

      if (jsonTokens.length === 0) {
        toast.error('数据不能为空')
        return
      }

      // 验证每个Token数据
      const validationErrors: string[] = []
      const validTokens: any[] = []

      jsonTokens.forEach((tokenData, index) => {
        const validation = validateTokenData(tokenData)
        if (validation.valid) {
          validTokens.push({
            tenant_url: tokenData.tenant_url,
            access_token: tokenData.access_token,
            portal_url: tokenData.portal_url || '',
            email_note: tokenData.email_note || ''
          })
        } else {
          validationErrors.push(`第${index + 1}条数据: ${validation.errors.join(', ')}`)
        }
      })

      if (validationErrors.length > 0) {
        toast.error(`数据验证失败:\n${validationErrors.join('\n')}`)
        return
      }

      // 调用批量导入API
      isLoading.value = true

      const response = await apiPost('/api/tokens/batch-import', {
        tokens: validTokens
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`批量导入完成，成功 ${data.successful} 条，失败 ${data.failed} 条`)
        closeAddModal()
        // 重新加载Token列表
        await refreshTokens()
      } else {
        toast.error(data.error || data.message || '批量导入失败')
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('JSON格式错误，请检查数据格式')
      } else {
        console.error('批量导入失败:', error)
        toast.error('批量导入失败，请稍后重试')
      }
    } finally {
      isLoading.value = false
    }
  }
}

// 保留原有的addToken方法以兼容
const addToken = () => {
  addSingleToken()
}

// 应用配置
const applications = [
  {
    name: 'VS Code',
    icon: 'vscode.svg',
    protocol: 'vscode'
  },
  {
    name: 'VS Codium',
    icon: 'vscodium.svg',
    protocol: 'vscodium'
  },
  {
    name: 'Cursor',
    icon: 'cursor.svg',
    protocol: 'cursor'
  },
  {
    name: 'Qoder',
    icon: 'qoder.svg',
    protocol: 'qoder'
  },
  {
    name: 'Trae',
    icon: 'trae.svg',
    protocol: 'trae'
  },
  {
    name: 'Kiro',
    icon: 'kiro.svg',
    protocol: 'kiro'
  },
  {
    name: 'CodeBuddy',
    icon: 'codebuddy.svg',
    protocol: 'codebuddy'
  }
]

// 获取图标URL
const getIconUrl = (iconName: string): string => {
  return `/icons/${iconName}`
}

const executeToken = (token: Token) => {
  // 检查Token状态
  const status = getTokenStatus(token)

  if (status === '失效') {
    toast.error('Token已失效，无法执行')
    return
  }

  if (status === '耗尽') {
    toast.warning('Token次数已耗尽，无法执行')
    return
  }

  // 未验证的Token也允许执行，只是给出提示
  if (status === '未验证') {
    toast.info('Token未验证，但仍可尝试执行')
  }

  currentExecuteToken.value = token
  showExecuteModal.value = true
}

// 执行应用
const executeApplication = async (app: any) => {
  if (!currentExecuteToken.value || isExecuting.value) return

  isExecuting.value = true

  try {
    const token = currentExecuteToken.value

    // 直接从token对象获取必要参数
    const accessToken = token.access_token
    const tenantUrl = token.tenant_url
    const portalUrl = token.portal_url

    // 验证必要参数
    if (!accessToken) {
      toast.error('Token访问令牌缺失，无法执行')
      return
    }

    if (!tenantUrl || !portalUrl) {
      toast.error('Token URL信息缺失，无法执行')
      return
    }

    const executeUrl = `${app.protocol}://augment.vscode-augment/autoAuth?token=${encodeURIComponent(accessToken)}&url=${encodeURIComponent(tenantUrl)}&portal=${encodeURIComponent(portalUrl)}`

    window.open(executeUrl, '_blank')
    toast.success(`正在启动 ${app.name}...`)
    showExecuteModal.value = false
  } catch (error) {
    console.error('启动应用失败:', error)
    toast.error(`启动 ${app.name} 失败`)
  } finally {
    isExecuting.value = false
  }
}

const refreshToken = async (token: Token) => {
  // 设置刷新状态
  refreshingToken.value = token
  isRefreshing.value = true

  try {
    const response = await apiPost(`/api/tokens/${token.id}/refresh`, {})

    const data = await response.json()

    if (data.success) {
      // 更新全部Token数据缓存
      const allIndex = allTokens.value.findIndex(t => t.id === token.id)
      if (allIndex > -1) {
        allTokens.value[allIndex] = data.data
      }

      // 更新当前页显示的Token数据
      const index = tokens.value.findIndex(t => t.id === token.id)
      if (index > -1) {
        tokens.value[index] = data.data
      }

      toast.success(data.message || 'Token 刷新成功')
    } else {
      toast.error(data.error || data.message || 'Token 刷新失败')
    }
  } catch (error) {
    console.error('Token刷新失败:', error)
    toast.error('网络错误，请重试')
  } finally {
    // 清除刷新状态
    isRefreshing.value = false
    refreshingToken.value = null
  }
}

const showEditTokenModal = async (token: Token) => {
  try {
    // 调用API获取Token详情
    const response = await apiGet(`/api/tokens/${token.id}`)
    const data = await response.json()

    if (data.success && data.data) {
      // 填充编辑表单数据
      editingToken.value = {
        id: data.data.id,
        tenant_url: data.data.tenant_url,
        access_token: data.data.access_token,
        portal_url: data.data.portal_url,
        email_note: data.data.email_note
      }
      showEditModal.value = true
    } else {
      toast.error(data.error || 'Token信息获取失败')
    }
  } catch (error) {
    console.error('获取Token详情失败:', error)
    toast.error('网络错误，请重试')
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  editingToken.value = {
    tenant_url: '',
    access_token: '',
    portal_url: '',
    email_note: ''
  }
}

const updateToken = async () => {
  if (!editingToken.value.id) {
    toast.error('Token ID 不能为空')
    return
  }

  if (!editingToken.value.tenant_url || !editingToken.value.access_token) {
    toast.error('Tenant URL 和 Access Token 不能为空')
    return
  }

  try {
    const response = await apiPut(`/api/tokens/${editingToken.value.id}`, {
      tenant_url: editingToken.value.tenant_url,
      access_token: editingToken.value.access_token,
      portal_url: editingToken.value.portal_url,
      email_note: editingToken.value.email_note
    })

    const data = await response.json()

    if (data.success) {
      // 更新全部Token数据缓存
      const allIndex = allTokens.value.findIndex(t => t.id === editingToken.value.id)
      if (allIndex > -1) {
        allTokens.value[allIndex] = data.data
      }

      // 更新当前页显示的Token数据
      const index = tokens.value.findIndex(t => t.id === editingToken.value.id)
      if (index > -1) {
        tokens.value[index] = data.data
      }

      toast.success(data.message || 'Token 更新成功')
      closeEditModal()
    } else {
      toast.error(data.error || data.message || 'Token 更新失败')
    }
  } catch (error) {
    console.error('更新Token失败:', error)
    toast.error('网络错误，请重试')
  }
}

const showDeleteTokenModal = (token: Token) => {
  deletingToken.value = token
  showDeleteModal.value = true
}

const closeDeleteModal = () => {
  showDeleteModal.value = false
  deletingToken.value = null
}

const confirmDelete = async () => {
  if (!deletingToken.value) {
    return
  }

  try {
    const response = await apiDelete(`/api/tokens/${deletingToken.value.id}`)

    const data = await response.json()

    if (data.success) {
      // 从全部Token数据缓存中移除
      const allIndex = allTokens.value.findIndex(t => t.id === deletingToken.value!.id)
      if (allIndex > -1) {
        allTokens.value.splice(allIndex, 1)
      }

      // 从当前页显示的Token数据中移除
      const index = tokens.value.findIndex(t => t.id === deletingToken.value!.id)
      if (index > -1) {
        tokens.value.splice(index, 1)
      }

      toast.success(data.message || 'Token 删除成功')
    } else {
      toast.error(data.error || data.message || 'Token 删除失败')
    }
  } catch (error) {
    console.error('删除Token失败:', error)
    toast.error('网络错误，请重试')
  } finally {
    closeDeleteModal()
  }
}

// 保留原有方法以兼容
const editToken = (token: Token) => {
  showEditTokenModal(token)
}

const deleteToken = (token: Token) => {
  showDeleteTokenModal(token)
}

// Token验证相关方法
const showValidateModal = (token: Token) => {
  const currentStatus = getTokenStatus(token)

  // 正常、未知和失效状态的Token都可以验证
  if (currentStatus !== '正常' && currentStatus !== '未知' && currentStatus !== '失效') {
    toast.info(`Token状态为"${currentStatus}"，无法验证`)
    return
  }

  validatingToken.value = token
  showValidateConfirmModal.value = true
}

const closeValidateModal = () => {
  showValidateConfirmModal.value = false
  validatingToken.value = null
  isValidating.value = false
}

const confirmValidateToken = async () => {
  if (!validatingToken.value) {
    return
  }

  const tokenToValidate = validatingToken.value

  // 检查Token状态，正常、未知和失效状态的Token都可以验证
  const currentStatus = getTokenStatus(tokenToValidate)
  if (currentStatus !== '正常' && currentStatus !== '未知' && currentStatus !== '失效') {
    toast.error(`Token状态为"${currentStatus}"，无法进行验证`)
    cancelValidateToken()
    return
  }

  // 立即关闭模态框，但保持validatingToken用于显示验证状态
  showValidateConfirmModal.value = false

  // 开始验证
  isValidating.value = true

  try {
    const response = await apiPost(`/api/tokens/${tokenToValidate.id}/validate`, {})

    const data = await response.json()

    if (data.success) {
      // 更新全部Token数据缓存
      const allIndex = allTokens.value.findIndex(t => t.id === tokenToValidate.id)
      if (allIndex > -1) {
        allTokens.value[allIndex] = data.data
      }

      // 更新当前页显示的Token数据
      const index = tokens.value.findIndex(t => t.id === tokenToValidate.id)
      if (index > -1) {
        tokens.value[index] = data.data
      }

      toast.success(data.message || 'Token 验证成功')
    } else {
      toast.error(data.error || data.message || 'Token 验证失败')
    }
  } catch (error) {
    console.error('Token验证失败:', error)
    toast.error('网络错误，请重试')
  } finally {
    isValidating.value = false
    validatingToken.value = null
  }
}

// 批量验证相关方法
const closeBatchValidateModal = () => {
  if (!isBatchValidating.value) {
    showBatchValidateModal.value = false
    batchValidateResults.value = {
      valid: 0,
      invalid: 0,
      failed: 0,
      total: 0
    }
  }
}

const confirmBatchValidate = async () => {
  isBatchValidating.value = true

  // 获取要验证的token（如果是选择模式，则只验证选中的token）
  const tokensToValidate = isSelectMode.value
    ? tokens.value.filter(token => selectedTokenIds.value.has(token.id))
    : tokens.value

  // 重置结果
  batchValidateResults.value = {
    valid: 0,
    invalid: 0,
    failed: 0,
    total: tokensToValidate.length
  }

  try {
    // 使用新的批量验证API
    const tokenIds = tokensToValidate.map(token => token.id)
    const response = await apiPost('/api/tokens/batch-validate', { tokenIds })

    const data = await response.json()

    if (data.success && data.data.results) {
      // 处理批量验证结果
      for (const result of data.data.results) {
        // 更新Token数据
        if (result.token) {
          // 更新全部Token数据缓存
          const allIndex = allTokens.value.findIndex(t => t.id === result.tokenId)
          if (allIndex > -1) {
            allTokens.value[allIndex] = result.token
          }

          // 更新当前页显示的Token数据
          const index = tokens.value.findIndex(t => t.id === result.tokenId)
          if (index > -1) {
            tokens.value[index] = result.token
          }
        }

        // 统计结果
        if (result.error) {
          batchValidateResults.value.failed++
        } else if (result.isValid) {
          batchValidateResults.value.valid++
        } else {
          batchValidateResults.value.invalid++
        }
      }

      // 显示详细结果
      const { valid, invalid, failed, total } = batchValidateResults.value
      const summary = data.data.summary
      toast.success(`批量验证完成！有效: ${summary?.valid || valid}, 失效: ${summary?.invalid || invalid}, 错误: ${summary?.errors || failed}, 总计: ${summary?.total || total}`)
    } else {
      // API调用失败，回退到逐个验证
      console.warn('批量验证API失败，回退到逐个验证')
      await fallbackIndividualValidation(tokensToValidate)
    }
  } catch (error) {
    console.error('批量验证失败，回退到逐个验证:', error)
    // 回退到逐个验证
    await fallbackIndividualValidation(tokensToValidate)
  }

  // 验证完成
  isBatchValidating.value = false

  // 延迟关闭模态框
  setTimeout(() => {
    closeBatchValidateModal()
    // 如果是选择模式，操作完成后清除选择
    if (isSelectMode.value) {
      selectedTokenIds.value.clear()
    }
  }, 2000)
}

// 回退到逐个验证的方法
const fallbackIndividualValidation = async (tokensToValidate) => {
  // 重置结果
  batchValidateResults.value = {
    valid: 0,
    invalid: 0,
    failed: 0,
    total: tokensToValidate.length
  }

  // 逐个验证Token，添加延迟
  for (let i = 0; i < tokensToValidate.length; i++) {
    const token = tokensToValidate[i]

    try {
      const response = await apiPost(`/api/tokens/${token.id}/validate`, {})
      const data = await response.json()

      if (data.success) {
        // 更新全部Token数据缓存
        const allIndex = allTokens.value.findIndex(t => t.id === token.id)
        if (allIndex > -1) {
          allTokens.value[allIndex] = data.data
        }

        // 更新当前页显示的Token数据
        const index = tokens.value.findIndex(t => t.id === token.id)
        if (index > -1) {
          tokens.value[index] = data.data
        }

        // 根据valid字段判断Token状态
        if (data.valid) {
          batchValidateResults.value.valid++
        } else {
          batchValidateResults.value.invalid++
        }
      } else {
        batchValidateResults.value.failed++
      }
    } catch (error) {
      console.error(`Token ${token.id} 验证失败:`, error)
      batchValidateResults.value.failed++
    }

    // 添加延迟，避免服务器压力（每个请求间隔500ms）
    if (i < tokensToValidate.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // 显示结果
  const { valid, invalid, failed, total } = batchValidateResults.value
  toast.success(`批量验证完成！有效: ${valid}, 失效: ${invalid}, 错误: ${failed}, 总计: ${total}`)
}

// 批量刷新相关方法
const closeBatchRefreshModal = () => {
  if (!isBatchRefreshing.value) {
    showBatchRefreshModal.value = false
    batchRefreshResults.value = {
      success: 0,
      failed: 0,
      total: 0
    }
  }
}

const confirmBatchRefresh = async () => {
  isBatchRefreshing.value = true

  // 获取要刷新的token（如果是选择模式，则只刷新选中的token）
  const tokensToRefresh = isSelectMode.value
    ? tokens.value.filter(token => selectedTokenIds.value.has(token.id))
    : tokens.value

  // 筛选出有portal_url的Token（只有这些Token可以刷新）
  const refreshableTokens = tokensToRefresh.filter(token => token.portal_url && token.portal_url.trim() !== '')

  // 重置结果
  batchRefreshResults.value = {
    success: 0,
    failed: 0,
    total: refreshableTokens.length
  }

  // 逐个刷新Token，添加延迟
  for (let i = 0; i < refreshableTokens.length; i++) {
    const token = refreshableTokens[i]

    try {
      const response = await apiPost(`/api/tokens/${token.id}/refresh`, {})

      const data = await response.json()

      if (data.success) {
        // 更新全部Token数据缓存
        const allIndex = allTokens.value.findIndex(t => t.id === token.id)
        if (allIndex > -1 && data.data) {
          allTokens.value[allIndex] = { ...allTokens.value[allIndex], ...data.data }
        }

        // 更新当前页显示的Token数据
        const index = tokens.value.findIndex(t => t.id === token.id)
        if (index > -1 && data.data) {
          tokens.value[index] = { ...tokens.value[index], ...data.data }
        }

        batchRefreshResults.value.success++
      } else {
        batchRefreshResults.value.failed++
        console.error(`Token ${token.id} 刷新失败:`, data.error || data.message)
      }
    } catch (error) {
      batchRefreshResults.value.failed++
      console.error(`Token ${token.id} 刷新错误:`, error)
    }

    // 添加延迟，避免服务器压力
    if (i < refreshableTokens.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // 刷新完成
  isBatchRefreshing.value = false

  // 显示结果
  const { success, failed, total } = batchRefreshResults.value
  toast.success(`批量刷新完成！成功: ${success}, 失败: ${failed}, 总计: ${total}`)

  // 延迟关闭模态框
  setTimeout(() => {
    closeBatchRefreshModal()
    // 如果是选择模式，操作完成后清除选择
    if (isSelectMode.value) {
      selectedTokenIds.value.clear()
    }
  }, 2000)
}

// 邮箱生成相关方法
const loadEmailDomains = async () => {
  try {
    const response = await apiGet('/api/email/domains')
    const data = await response.json()
    if (data.success) {
      emailDomains.value = data.data.domains || []
    }
  } catch (error) {
    console.error('获取邮箱域名失败:', error)
  }
}

const generateEmail = async () => {
  // 在重激活模式下禁用邮箱生成
  if (isReactivateMode.value) {
    toast.warning('重激活模式下无法生成新邮箱')
    return
  }

  isGeneratingEmail.value = true
  try {
    const options: any = {
      type: emailType.value,
      length: emailLength.value || 10
    }

    if (emailType.value === 'word' && emailPrefix.value) {
      options.prefix = emailPrefix.value
    }

    if (selectedDomain.value === 'custom' && customDomain.value) {
      if (!customDomain.value.trim()) {
        toast.error('请输入自定义域名')
        return
      }
      options.customDomain = customDomain.value.trim()
    } else if (selectedDomain.value && selectedDomain.value !== 'custom') {
      options.domain = selectedDomain.value
    }

    const response = await apiPost('/api/email/generate', options)
    const data = await response.json()

    if (data.success) {
      generatedEmail.value = data.data.email
      // 更新可用域名列表
      if (data.data.availableDomains) {
        emailDomains.value = data.data.availableDomains
      }
      toast.success('邮箱生成成功')
    } else {
      // 检查是否是配置错误
      if (data.error && data.error.includes('not configured')) {
        toast.error('邮箱服务未配置，请联系管理员')
      } else {
        toast.error(data.error || '邮箱生成失败')
      }
    }
  } catch (error) {
    console.error('邮箱生成失败:', error)
    toast.error('网络错误，请重试')
  } finally {
    isGeneratingEmail.value = false
  }
}

const getVerificationCode = async (isAutoRefresh = false) => {
  if (!generatedEmail.value) {
    if (!isAutoRefresh) {
      toast.warning('请先生成邮箱或输入邮箱地址')
    }
    return false
  }

  isGettingVerificationCode.value = true
  try {
    const url = `/api/email/verification-code?email=${encodeURIComponent(generatedEmail.value)}`
    const response = await apiGet(url)
    const data = await response.json()

    if (data.success) {
      const newCode = data.verificationCode || ''

      // 检查是否与上次获取的验证码相同
      if (isAutoRefresh && newCode === lastVerificationCode.value && newCode !== '') {
        return false
      }

      // 更新验证码信息
      verificationCode.value = newCode
      verificationEmail.value = data.recipientEmail || ''
      verificationTimestamp.value = data.timestamp || ''
      lastVerificationCode.value = newCode

      if (!isAutoRefresh) {
        toast.success('验证码获取成功')
      }

      return true
    } else {
      if (!isAutoRefresh) {
        // 检查是否是配置错误
        if (data.error && data.error.includes('not configured')) {
          toast.error('邮箱服务未配置，请联系管理员')
        } else {
          toast.error(data.error || '验证码获取失败')
        }
      }
      return false
    }
  } catch (error) {
    console.error('验证码获取失败:', error)
    if (!isAutoRefresh) {
      toast.error('网络错误，请重试')
    }
    return false
  } finally {
    isGettingVerificationCode.value = false
  }
}

const copyEmail = async () => {
  try {
    await navigator.clipboard.writeText(generatedEmail.value)
    toast.success('邮箱已复制到剪贴板')
  } catch (err) {
    console.error('复制失败:', err)
    toast.error('复制失败')
  }
}

const copyVerificationCode = async () => {
  try {
    await navigator.clipboard.writeText(verificationCode.value)
    toast.success('验证码已复制到剪贴板')
  } catch (err) {
    console.error('复制失败:', err)
    toast.error('复制失败')
  }
}

const toggleAutoRefresh = () => {
  if (autoRefreshVerificationCode.value) {
    startVerificationRefresh()
  } else {
    stopVerificationRefresh()
  }
}

const startVerificationRefresh = () => {
  if (verificationRefreshTimer.value) {
    clearInterval(verificationRefreshTimer.value)
  }

  const doRefresh = async () => {
    const result = await getVerificationCode(true)

    // 简化逻辑：固定10秒间隔，只判断是否相同，相同时不弹窗提示

    // 重新设置定时器，固定10秒间隔
    if (autoRefreshVerificationCode.value) {
      stopVerificationRefresh()
      verificationRefreshTimer.value = setTimeout(doRefresh, 10000)
    }
  }

  // 立即执行一次，然后设置定时器
  verificationRefreshTimer.value = setTimeout(doRefresh, 10000)
}

const stopVerificationRefresh = () => {
  if (verificationRefreshTimer.value) {
    clearTimeout(verificationRefreshTimer.value)
    verificationRefreshTimer.value = null
  }
}

const formatTimestamp = (timestamp: string) => {
  // 只显示时间部分，不显示日期
  return new Date(timestamp).toLocaleTimeString()
}

// 处理状态点击事件
const handleStatusClick = (token: Token) => {
  const status = getTokenStatus(token)

  // 如果Token已分享，显示分享信息
  if (isTokenShared(token)) {
    showShareInfoModal(token)
    return
  }

  if (status === '失效') {
    // 失效状态：显示选择菜单（验证或重新激活）
    showInvalidTokenActionModal.value = true
    selectedInvalidToken.value = token
  } else {
    showValidateModal(token)
  }
}

// 重激活相关方法
const closeReactivateModal = () => {
  showReactivateModal.value = false
  reactivatingToken.value = null
  isReactivating.value = false
  // 清除可能设置的邮箱信息，避免影响后续的新建Token流程
  generatedEmail.value = ''
  emailNote.value = ''
}

// 失效Token操作选择相关方法
const closeInvalidTokenActionModal = () => {
  showInvalidTokenActionModal.value = false
  selectedInvalidToken.value = null
}

const validateInvalidToken = () => {
  if (selectedInvalidToken.value) {
    const token = selectedInvalidToken.value
    closeInvalidTokenActionModal()
    showValidateModal(token)
  }
}

const reactivateInvalidToken = () => {
  if (selectedInvalidToken.value) {
    reactivatingToken.value = selectedInvalidToken.value
    closeInvalidTokenActionModal()
    showReactivateModal.value = true
  }
}

const confirmReactivateToken = async () => {
  if (!reactivatingToken.value) {
    return
  }

  const tokenToReactivate = reactivatingToken.value
  isReactivating.value = true

  try {
    // 关闭重激活模态框
    closeReactivateModal()

    // 打开获取Token模态框，并预设邮箱信息
    showGetTokenModal(true)

    // 如果有原邮箱信息，预设到生成的邮箱字段
    if (tokenToReactivate.email_note) {
      generatedEmail.value = tokenToReactivate.email_note
      emailNote.value = tokenToReactivate.email_note
    }

    // 保持重激活Token的引用，用于判断重激活模式
    reactivatingToken.value = tokenToReactivate

    toast.info('已进入重激活流程，将使用原邮箱重新获取Token')
  } catch (error) {
    console.error('重激活失败:', error)
    toast.error('重激活失败，请重试')
  } finally {
    isReactivating.value = false
  }
}

// 在组件挂载时加载邮箱域名
onMounted(() => {
  loadEmailDomains()
})

// 在组件卸载时清理定时器
onUnmounted(() => {
  stopVerificationRefresh()
})

// 更新Token数组的辅助函数
const updateTokenInArrays = (updatedToken: Token) => {
  // 更新全部Token数据缓存
  const allIndex = allTokens.value.findIndex(t => t.id === updatedToken.id)
  if (allIndex > -1) {
    allTokens.value[allIndex] = updatedToken
  }

  // 更新当前页显示的Token数据
  const index = tokens.value.findIndex(t => t.id === updatedToken.id)
  if (index > -1) {
    tokens.value[index] = updatedToken
  }
}

// 分享相关方法
const shareToken = async (token: Token) => {
  try {
    const response = await apiPost(`/api/tokens/${token.id}/share`, {})

    if (!response.ok) {
      const errorData = await response.json()
      toast.error(errorData.error || errorData.message || 'Token分享失败')
      return
    }

    const data = await response.json()

    if (data.success) {
      toast.success(data.message || 'Token分享成功！')

      // 局部更新Token数据，只更新分享相关字段
      const updatedFields = {
        share_info: data.data.share_info,
        is_shared: data.data.is_shared,
        updated_at: new Date().toISOString()
      }

      // 更新全部Token数据缓存
      const allIndex = allTokens.value.findIndex(t => t.id === token.id)
      if (allIndex > -1) {
        allTokens.value[allIndex] = { ...allTokens.value[allIndex], ...updatedFields }
      }

      // 更新当前页显示的Token数据
      const index = tokens.value.findIndex(t => t.id === token.id)
      if (index > -1) {
        tokens.value[index] = { ...tokens.value[index], ...updatedFields }
      }

      // 关闭编辑模态框
      closeEditModal()

      // 显示分享信息
      const updatedToken = { ...token, ...updatedFields }
      showShareInfoModal(updatedToken)
    } else {
      toast.error(data.error || data.message || 'Token分享失败')
    }
  } catch (error) {
    console.error('Share token error:', error)
    toast.error('Token分享失败，请重试')
  }
}

const showShareInfoModal = (token: Token) => {
  shareInfoToken.value = token
  showShareInfoModalFlag.value = true
}

const closeShareInfoModal = () => {
  showShareInfoModalFlag.value = false
  shareInfoToken.value = null
}

const resetRechargeCard = async (token: Token | null) => {
  if (!token) return

  try {
    const response = await apiPost(`/api/tokens/${token.id}/reset-card`, {})
    const data = await response.json()



    if (data.success) {
      toast.success(data.message || '激活码重置成功！')

      // 局部更新Token数据
      const updatedToken = {
        ...token,
        share_info: data.data.share_info,
        updated_at: new Date().toISOString()
      }
      updateTokenInArrays(updatedToken)
      shareInfoToken.value = updatedToken
    } else {
      toast.error(data.error || data.message || '激活码重置失败')
    }
  } catch (error) {
    console.error('Reset recharge card error:', error)
    toast.error('激活码重置失败，请重试')
  }
}

const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label}已复制到剪贴板`)
  } catch (error) {
    console.error('Copy to clipboard error:', error)
    toast.error('复制失败，请手动复制')
  }
}

// 辅助函数
const isTokenShared = (token: Token): boolean => {
  return token.is_shared === true
}

const getShareInfo = (token: Token | null): { recharge_card: string; deactivation_code: string | null } | null => {
  if (!token?.share_info) return null
  try {
    return JSON.parse(token.share_info)
  } catch (e) {
    return null
  }
}
</script>

<style scoped>
/* 通用样式 */
.cursor-pointer {
  cursor: pointer;
}

/* 刷新按钮旋转动画 */
.refresh-spin {
  animation: refresh-rotate 1s linear infinite !important;
  transform-origin: center center !important;
  display: inline-block !important;
}

i.refresh-spin {
  animation: refresh-rotate 1s linear infinite !important;
  transform-origin: center center !important;
  display: inline-block !important;
}

@keyframes refresh-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 浏览器兼容性 */
@-webkit-keyframes refresh-rotate {
  0% {
    -webkit-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}

/* 拖拽上传样式 */
.dropzone {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #f8f9fa;
}

.dropzone:hover,
.dropzone-dragover {
  border-color: #0d6efd;
  background-color: #e7f3ff;
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 步骤指示器样式 */
.steps-wrapper {
  padding: 0 20px;
}

.steps {
  display: flex;
  align-items: center;
  justify-content: center;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 120px;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #dee2e6;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  transition: all 0.3s ease;
  border: 2px solid #dee2e6;
}

.step-title {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
  line-height: 1.2;
}

/* 应用卡片样式 */
.app-card {
  transition: all 0.2s ease-in-out;
  border: 1px solid var(--bs-border-color);
}

.app-card:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--bs-primary);
}

.app-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.app-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.app-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bs-body-color);
}

.step-active .step-number {
  background-color: #0d6efd;
  color: white;
  border-color: #0d6efd;
}

.step-active .step-title {
  color: #0d6efd;
  font-weight: 600;
}

.step-completed .step-number {
  background-color: #198754;
  color: white;
  border-color: #198754;
}

.step-completed .step-title {
  color: #198754;
  font-weight: 600;
}

.step-divider {
  flex: 1;
  height: 2px;
  background-color: #dee2e6;
  margin: 0 16px;
  margin-bottom: 24px;
  transition: background-color 0.3s ease;
}

.divider-active {
  background-color: #198754;
}

/* 响应式设计 */
@media (max-width: 576px) {
  .step {
    min-width: 80px;
  }

  .step-title {
    font-size: 11px;
  }

  .step-divider {
    margin: 0 8px;
    margin-bottom: 24px;
  }

  /* 移动端统计卡片优化 */
  .card-sm {
    margin-bottom: 0.75rem;
  }

  .card-sm .card-body {
    padding: 0.75rem;
  }

  .card-sm .h1 {
    font-size: 1.5rem;
  }

  .card-sm .font-weight-medium {
    font-size: 0.875rem;
  }

  .card-sm .text-muted {
    font-size: 0.75rem;
  }

  .card-sm .avatar {
    width: 2rem;
    height: 2rem;
  }

  .card-sm .avatar i {
    font-size: 1rem;
  }
}

/* 表格样式优化 */
.table th {
  border-top: none;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--bs-body-color);
  background-color: var(--bs-body-bg);
  position: sticky;
  top: 0;
  z-index: 10;
}

/* 排序表头样式 */
.sortable-header {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.sortable-header:hover {
  background-color: var(--bs-secondary-bg);
}

.sortable-header.sorted {
  background-color: var(--bs-secondary-bg);
  font-weight: 600;
}

.sortable-header i {
  font-size: 0.75rem;
  opacity: 0.7;
}

.sortable-header.sorted i {
  opacity: 1;
  color: var(--bs-primary);
}

/* 中等屏幕优化 */
@media (max-width: 768px) {
  .card-sm .row.align-items-center {
    gap: 0.5rem;
  }

  .card-sm .col-auto:last-child {
    text-align: right;
  }
}

/* 筛选卡片样式 */
.cursor-pointer {
  cursor: pointer;
}

.cursor-pointer:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

/* 卡片选择模式样式 */
.card-selectable {
  transition: all 0.2s ease;
}

.card-selectable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-selectable.border-primary {
  border-width: 2px !important;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}
</style>
