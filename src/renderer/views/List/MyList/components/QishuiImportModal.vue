<template>
  <material-modal :show="modelValue" bg-close teleport="#view" width="560px" max-height="86%" @close="handleClose">
    <main class="scroll" :class="$style.main">
      <header :class="$style.title">
        <h2>{{ $t('qishui__title') }}</h2>
      </header>

      <!-- 阶段一：扫码登录 -->
      <section v-if="phase == 'login'" :class="$style.form">
        <p :class="$style.tip">{{ $t('qishui__qr_tip') }}</p>
        <div :class="$style.qrBox">
          <img v-if="qrImage" :src="qrImage" :class="$style.qrImg" alt="QR">
          <div v-else :class="$style.qrLoading">{{ $t('qishui__qr_loading') }}</div>
        </div>
        <p v-if="qrStatus" :class="$style.qrStatus">{{ qrStatus }}</p>
        <p v-if="error" :class="$style.error">{{ error }}</p>
      </section>

      <!-- 阶段二：选择歌单 -->
      <section v-else :class="$style.accountSection">
        <div :class="$style.accountBar">
          <span :class="$style.accountName">{{ $t('qishui__account', { name: nickname || '汽水音乐' }) }}</span>
          <div :class="$style.accountActions">
            <base-btn min outline :disabled="loading" @click="handleLoadLibrary">{{ $t('qishui__refresh') }}</base-btn>
            <base-btn min outline :disabled="loading" @click="handleLogout">{{ $t('qishui__logout') }}</base-btn>
          </div>
        </div>
        <div :class="$style.selectionBar">
          <base-checkbox
            id="qishui_select_all" :model-value="allSelected" :label="$t('qishui__select_all')"
            @change="handleSelectAll"
          />
          <span>{{ $t('qishui__playlist_count', { count: playlists.length }) }}</span>
        </div>
        <ul v-if="playlists.length" class="scroll" :class="$style.playlists">
          <li v-for="playlist in playlists" :key="playlist.id" :class="$style.playlist">
            <base-checkbox
              :id="`qishui_playlist_${playlist.id}`" v-model="selectedIds" :value="playlist.id"
              :label="playlist.name"
            />
            <span :class="$style.trackCount">{{ playlist.trackCount }}</span>
          </li>
        </ul>
        <p v-else :class="$style.empty">{{ $t('qishui__empty') }}</p>
        <div :class="$style.footer">
          <span v-if="status" :class="$style.status">{{ status }}</span>
          <base-btn
            :class="$style.primaryBtn" :disabled="loading || !selectedIds.length"
            @click="handleImport"
          >
            {{ loading ? progress : $t('qishui__import_selected') }}
          </base-btn>
        </div>
        <p :class="$style.hint">{{ $t('qishui__play_hint') }}</p>
      </section>

      <p v-if="error && phase != 'login'" :class="$style.error">{{ error }}</p>
    </main>
  </material-modal>
</template>

<script>
import { computed, ref, watch, onBeforeUnmount } from '@common/utils/vueTools'
import { useI18n } from '@root/lang'
import {
  createQishuiQrCode,
  checkQishuiQrConnect,
  clearQishuiQr,
  getQishuiLibrary,
  getQishuiPlaylistTracks,
} from '@renderer/utils/ipc'
import { createUserList } from '@renderer/store/list/action'
import { getUserLists } from '@renderer/store/list/listManage'

export default {
  name: 'QishuiImportModal',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const t = useI18n()

    const phase = ref('login') // login | list
    const qrImage = ref('')
    const qrStatus = ref('')
    const error = ref('')
    const status = ref('')
    const loading = ref(false)
    const nickname = ref('')
    const playlists = ref([])
    const selectedIds = ref([])
    const progress = ref('')

    const qrToken = ref('')
    let pollTimer = null
    let qrRefreshTimer = null
    let polling = false

    const allSelected = computed(() => playlists.value.length > 0 && selectedIds.value.length == playlists.value.length)

    const stopPolling = () => {
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }
      if (qrRefreshTimer) { clearTimeout(qrRefreshTimer); qrRefreshTimer = null }
      polling = false
    }

    const schedulePoll = (delay = 2500) => {
      if (!props.modelValue || polling) return
      polling = true
      pollTimer = setTimeout(async() => {
        polling = false
        if (!props.modelValue || !qrToken.value) return
        try {
          const result = await checkQishuiQrConnect(qrToken.value)
          if (result.loggedIn) {
            stopPolling()
            await handleLoadLibrary().catch(err => {
              error.value = err?.message || t('qishui__load_failed')
            })
            return
          }
          switch (result.status) {
            case 'scanned':
              qrStatus.value = t('qishui__qr_scanned')
              break
            case 'expired':
              qrStatus.value = t('qishui__qr_expired')
              // 稍后自动刷新二维码
              qrToken.value = ''
              qrRefreshTimer = setTimeout(() => { void loadQrCode() }, 1500)
              return
            case 'rate_limited':
              qrStatus.value = t('qishui__qr_rate')
              break
            default:
              qrStatus.value = t('qishui__qr_waiting')
          }
        } catch (err) {
          // 轮询单次失败不中断（网络抖动/二次验证取消等），继续下一轮
          if (err?.code == 'QISHUI_MFA_CANCELLED') {
            qrStatus.value = err.message || t('qishui__login_timeout')
          }
        }
        schedulePoll()
      }, delay)
    }

    const loadQrCode = async() => {
      stopPolling()
      qrImage.value = ''
      qrStatus.value = t('qishui__qr_loading')
      error.value = ''
      try {
        const result = await createQishuiQrCode()
        qrToken.value = result.token
        qrImage.value = result.qrcode
        qrStatus.value = t('qishui__qr_waiting')
        schedulePoll()
      } catch (err) {
        qrStatus.value = ''
        error.value = err?.message || t('qishui__load_failed')
        // 获取失败后间隔重试
        qrRefreshTimer = setTimeout(() => { void loadQrCode() }, 5000)
      }
    }

    const handleLoadLibrary = async() => {
      loading.value = true
      error.value = ''
      status.value = ''
      try {
        const result = await getQishuiLibrary()
        nickname.value = result.nickname
        playlists.value = result.playlists
        selectedIds.value = result.playlists.map(p => p.id)
        phase.value = 'list'
      } catch (err) {
        error.value = err?.message || t('qishui__load_failed')
      } finally {
        loading.value = false
      }
    }

    const handleLogout = async() => {
      stopPolling()
      await clearQishuiQr().catch(() => {})
      playlists.value = []
      selectedIds.value = []
      nickname.value = ''
      phase.value = 'login'
      void loadQrCode()
    }

    const uniqueListName = async(name) => {
      const lists = await getUserLists()
      const names = new Set(lists.map(l => l.name))
      if (!names.has(name)) return name
      let idx = 2
      while (names.has(`${name} ${idx}`)) idx += 1
      return `${name} ${idx}`
    }

    const handleImport = async() => {
      const targets = playlists.value.filter(p => selectedIds.value.includes(p.id))
      loading.value = true
      error.value = ''
      let imported = 0
      let failed = 0
      let songTotal = 0
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i]
        progress.value = t('qishui__import_progress', { name: target.name, current: i + 1, total: targets.length })
        try {
          const tracks = await getQishuiPlaylistTracks(target.id)
          const musicInfos = tracks.map(track => ({
            id: `qishui_${track.id}`,
            source: 'qishui',
            name: track.name,
            singer: track.singer,
            interval: track.interval || null,
            meta: {
              songId: track.id,
              albumName: track.album,
              picUrl: track.cover || null,
              qualitys: [{ type: 'flac24bit', size: null }, { type: 'flac', size: null }, { type: '320k', size: null }, { type: '128k', size: null }],
              _qualitys: { flac24bit: {}, flac: {}, '320k': {}, '128k': {} },
            },
          }))
          const name = await uniqueListName(target.name)
          await createUserList({ name, list: musicInfos, source: 'qishui' })
          imported += 1
          songTotal += musicInfos.length
        } catch (_) {
          failed += 1
        }
      }
      loading.value = false
      progress.value = ''
      status.value = failed
        ? t('qishui__import_partial', { imported, failed })
        : t('qishui__import_done', { imported, songs: songTotal })
      selectedIds.value = []
      playlists.value = []
    }

    const handleSelectAll = () => {
      selectedIds.value = allSelected.value ? [] : playlists.value.map(p => p.id)
    }

    const handleClose = () => {
      emit('update:modelValue', false)
    }

    watch(() => props.modelValue, (show) => {
      if (show) {
        phase.value = 'login'
        playlists.value = []
        selectedIds.value = []
        nickname.value = ''
        status.value = ''
        error.value = ''
        progress.value = ''
        void loadQrCode()
      } else {
        stopPolling()
      }
    })

    onBeforeUnmount(stopPolling)

    return {
      phase,
      qrImage,
      qrStatus,
      error,
      status,
      loading,
      nickname,
      playlists,
      selectedIds,
      progress,
      allSelected,
      handleLoadLibrary,
      handleLogout,
      handleImport,
      handleSelectAll,
      handleClose,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 15px;
  min-height: 300px;
}
.title {
  margin-bottom: 12px;
  text-align: center;

  h2 {
    word-break: break-all;
  }
}
.form {
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  gap: 12px;
}
.tip {
  font-size: 13px;
  color: var(--color-font-label);
  text-align: center;
  line-height: 1.5;
}
.qrBox {
  flex: none;
  width: 200px;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qrImg {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.qrLoading {
  color: #333;
  font-size: 13px;
}
.qrStatus {
  font-size: 13px;
  color: var(--color-font-label);
}
.accountSection {
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
}
.accountBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.accountName {
  font-size: 13px;
  color: var(--color-font);
  .mixin-ellipsis-1();
}
.accountActions {
  flex: none;
  display: flex;
  gap: 8px;
}
.selectionBar {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--color-font-label);
}
.playlists {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-flow: column nowrap;
  gap: 4px;
  padding: 4px;
  border-radius: @radius-border;
  border: 1px solid var(--glass-stroke, transparent);
}
.playlist {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 6px;
  border-radius: 6px;

  &:hover {
    background: color-mix(in srgb, var(--color-font) 4%, transparent);
  }
}
.trackCount {
  flex: none;
  font-size: 12px;
  color: var(--color-font-label);
  font-variant-numeric: tabular-nums;
}
.empty {
  padding: 20px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-font-label);
}
.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.status {
  flex: auto;
  font-size: 12px;
  color: var(--color-font-label);
  text-align: left;
  .mixin-ellipsis-1();
}
.hint {
  font-size: 12px;
  color: var(--color-font-label);
  opacity: .8;
}
.error {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-danger, #e05050);
  word-break: break-all;
}
</style>
