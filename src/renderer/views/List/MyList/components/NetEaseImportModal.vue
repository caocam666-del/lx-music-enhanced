<template>
  <material-modal frosted :show="modelValue" bg-close teleport="#view" width="680px" max-height="86%" @close="handleClose">
    <main class="scroll" :class="$style.main">
      <header :class="$style.title">
        <h2>{{ $t('netease__title') }}</h2>
      </header>

      <section v-if="!account" :class="$style.form">
        <!-- Luminous Harmonic: 登录方式页签 — 扫码(默认) / Cookie 粘贴, 扫码成功后复用既有歌单拉取 -->
        <div :class="$style.tabBar">
          <button
            type="button" :class="[$style.tabBtn, { [$style.tabActive]: loginMode == 'qr' }]"
            @click="loginMode = 'qr'"
          >{{ $t('netease__tab_qr') }}</button>
          <button
            type="button" :class="[$style.tabBtn, { [$style.tabActive]: loginMode == 'cookie' }]"
            @click="loginMode = 'cookie'"
          >{{ $t('netease__tab_cookie') }}</button>
        </div>

        <div v-show="loginMode == 'qr'" :class="$style.qrWrap">
          <div :class="$style.qrBox">
            <img v-if="qrImage" :src="qrImage" :class="$style.qrImg" alt="QR">
            <div v-else :class="$style.qrLoading">{{ $t('netease__qr_loading') }}</div>
          </div>
          <p :class="$style.qrStatus">{{ qrStatus || $t('netease__qr_waiting') }}</p>
        </div>

        <div v-show="loginMode == 'cookie'">
          <p :class="$style.tip">{{ $t('netease__cookie_tip') }}</p>
          <textarea
            ref="cookieInput" v-model="cookieText" :class="$style.cookieInput"
            :placeholder="$t('netease__cookie_placeholder')" spellcheck="false" autocomplete="off"
          />
          <base-btn :class="$style.primaryBtn" :disabled="loading || !cookieText.trim()" @click="handleLoad">
            {{ loading ? $t('netease__loading') : $t('netease__verify') }}
          </base-btn>
        </div>
      </section>

      <section v-else :class="$style.accountSection">
        <div :class="$style.accountBar">
          <span :class="$style.accountName">{{ $t('netease__account', { name: account.nickname }) }}</span>
          <div :class="$style.accountActions">
            <base-btn min outline :disabled="loading" @click="handleLoadSaved">{{ $t('netease__refresh') }}</base-btn>
            <base-btn min outline :disabled="loading" @click="handleClear">{{ $t('netease__clear_cookie') }}</base-btn>
          </div>
        </div>
        <div :class="$style.selectionBar">
          <base-checkbox
            id="netease_select_all" :model-value="allSelected" :label="$t('netease__select_all')"
            @change="handleSelectAll"
          />
          <span>{{ $t('netease__playlist_count', { count: playlists.length }) }}</span>
        </div>
        <ul v-if="playlists.length" class="scroll" :class="$style.playlists">
          <li v-for="playlist in playlists" :key="playlist.id" :class="$style.playlist">
            <base-checkbox
              :id="`netease_playlist_${playlist.id}`" v-model="selectedIds" :value="playlist.id"
              :label="playlist.name"
            />
            <span :class="$style.trackCount">{{ playlist.total }}</span>
          </li>
        </ul>
        <p v-else :class="$style.empty">{{ $t('netease__empty') }}</p>
        <div :class="$style.footer">
          <span v-if="status" :class="$style.status">{{ status }}</span>
          <base-btn
            :class="$style.primaryBtn" :disabled="loading || !selectedIds.length"
            @click="handleImport"
          >
            {{ loading ? progress : $t('netease__import_selected') }}
          </base-btn>
        </div>
      </section>

      <p v-if="error" :class="$style.error">{{ error }}</p>
    </main>
  </material-modal>
</template>

<script>
import { computed, ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import musicSdk from '@renderer/utils/musicSdk'
import { getListDetailAll } from '@renderer/store/songList/action'
import { createUserList } from '@renderer/store/list/action'
import syncSourceList from '@renderer/store/list/syncSourceList'
import { userLists } from '@renderer/store/list/state'
import { clearNeteaseCookieValue, getNeteaseCookieValue, saveNeteaseCookieValue } from '@renderer/utils/neteaseAuth'
import { loginQrCheck, loginQrCreate, loginQrKey } from '@renderer/utils/musicSdk/wy/loginQr'

export default {
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const t = useI18n()
    const cookieInput = ref(null)
    const cookieText = ref('')
    const account = ref(null)
    const playlists = ref([])
    const selectedIds = ref([])
    const loading = ref(false)
    const progress = ref('')
    const status = ref('')
    const error = ref('')

    // Luminous Harmonic: 扫码登录状态机 — key/create/check 轮询, 成功后 cookie 走既有存储
    const loginMode = ref('qr')
    const qrImage = ref('')
    const qrStatus = ref('')
    const qrKey = ref('')
    let qrPollTimer = null
    let qrRetryTimer = null

    const stopQrPolling = () => {
      if (qrPollTimer) { clearTimeout(qrPollTimer); qrPollTimer = null }
      if (qrRetryTimer) { clearTimeout(qrRetryTimer); qrRetryTimer = null }
    }

    const handleQrSuccess = async(cookie) => {
      stopQrPolling()
      qrStatus.value = ''
      await saveNeteaseCookieValue(cookie)
      await loadAccount()
    }

    const scheduleQrPoll = (delay = 2500) => {
      qrPollTimer = setTimeout(async() => {
        if (!props.modelValue || loginMode.value != 'qr' || !qrKey.value) return
        try {
          const result = await loginQrCheck(qrKey.value)
          if (result.status == 'success') {
            void handleQrSuccess(result.cookie)
            return
          }
          if (result.status == 'expired') {
            qrStatus.value = t('netease__qr_expired')
            qrKey.value = ''
            qrRetryTimer = setTimeout(() => { void loadQrCode() }, 1500)
            return
          }
          qrStatus.value = result.status == 'scanned' ? t('netease__qr_scanned') : t('netease__qr_waiting')
        } catch (err) {
          qrStatus.value = err?.message || t('netease__qr_waiting')
        }
        scheduleQrPoll()
      }, delay)
    }

    const loadQrCode = async() => {
      stopQrPolling()
      qrImage.value = ''
      qrStatus.value = t('netease__qr_loading')
      try {
        qrKey.value = await loginQrKey()
        const created = await loginQrCreate(qrKey)
        qrImage.value = created.qrimg
        qrStatus.value = t('netease__qr_waiting')
        scheduleQrPoll()
      } catch (err) {
        qrStatus.value = err?.message || t('netease__qr_loading_failed')
        qrRetryTimer = setTimeout(() => { void loadQrCode() }, 5000)
      }
    }

    const allSelected = computed(() => playlists.value.length > 0 && selectedIds.value.length === playlists.value.length)

    const setPlaylists = (list) => {
      playlists.value = list
      selectedIds.value = list.map(item => item.id)
    }

    const errorText = (err) => {
      const key = err?.message === 'INVALID_COOKIE'
        ? 'netease__invalid_cookie'
        : err?.message === 'NETEASE_AUTH_REQUIRED'
          ? 'netease__auth_required'
          : 'netease__load_failed'
      return t(key)
    }

    const loadAccount = async() => {
      loading.value = true
      error.value = ''
      try {
        const savedCookie = await getNeteaseCookieValue()
        if (!savedCookie) return
        account.value = await musicSdk.wy.songList.getAccount()
        setPlaylists(await musicSdk.wy.songList.getUserPlaylists(account.value.id))
      } catch (err) {
        account.value = null
        playlists.value = []
        selectedIds.value = []
        error.value = errorText(err)
      } finally {
        loading.value = false
      }
    }

    const handleLoad = async() => {
      loading.value = true
      error.value = ''
      status.value = ''
      try {
        await saveNeteaseCookieValue(cookieText.value.trim())
        account.value = await musicSdk.wy.songList.getAccount()
        setPlaylists(await musicSdk.wy.songList.getUserPlaylists(account.value.id))
      } catch (err) {
        account.value = null
        playlists.value = []
        selectedIds.value = []
        error.value = errorText(err)
      } finally {
        loading.value = false
      }
    }

    const handleLoadSaved = () => {
      void loadAccount()
    }

    const handleSelectAll = (checked) => {
      selectedIds.value = checked ? playlists.value.map(item => item.id) : []
    }

    const handleImport = async() => {
      const selected = playlists.value.filter(item => selectedIds.value.includes(item.id))
      if (!selected.length) return
      loading.value = true
      error.value = ''
      status.value = ''
      let imported = 0
      let failed = 0
      try {
        for (const playlist of selected) {
          progress.value = t('netease__import_progress', { current: imported + 1, total: selected.length })
          const target = userLists.find(list => list.source === 'wy' && String(list.sourceListId) === playlist.id)
          try {
            if (target) {
              await syncSourceList(target)
            } else {
              const list = await getListDetailAll(playlist.id, 'wy', true)
              await createUserList({
                name: playlist.name,
                list,
                source: 'wy',
                sourceListId: playlist.id,
              })
            }
            imported++
          } catch {
            failed++
          }
        }
        status.value = failed
          ? t('netease__import_partial', { imported, failed })
          : t('netease__import_done', { count: imported })
      } finally {
        loading.value = false
        progress.value = ''
      }
    }

    const handleClear = async() => {
      await clearNeteaseCookieValue()
      account.value = null
      playlists.value = []
      selectedIds.value = []
      cookieText.value = ''
      error.value = ''
      status.value = ''
    }

    const handleClose = () => emit('update:modelValue', false)

    watch(() => props.modelValue, (visible) => {
      if (!visible) {
        stopQrPolling()
        return
      }
      cookieText.value = ''
      error.value = ''
      status.value = ''
      void loadAccount()
      if (loginMode.value == 'qr' && !account.value) void loadQrCode()
    })
    watch(loginMode, (mode) => {
      if (!props.modelValue || account.value) return
      if (mode == 'qr') void loadQrCode()
      else stopQrPolling()
    })

    return {
      cookieInput,
      cookieText,
      loginMode,
      qrImage,
      qrStatus,
      account,
      playlists,
      selectedIds,
      allSelected,
      loading,
      progress,
      status,
      error,
      handleLoad,
      handleLoadSaved,
      handleSelectAll,
      handleImport,
      handleClear,
      handleClose,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  width: 100%;
  max-height: 80vh;
  padding: 0 15px 15px;
  box-sizing: border-box;
}
.title {
  margin-bottom: 10px;
  padding: 0;
  text-align: center;

  h2 { margin: 0; font-size: 16px; line-height: 1.3; color: var(--color-primary); letter-spacing: 0.01em; word-break: break-all; }
}
// Luminous Harmonic: 登录方式页签 + 扫码二维码
.tabBar {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 14px;
}
.tabBtn {
  padding: 5px 16px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent);
  background: transparent;
  color: var(--color-font-label);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);

  &:hover { color: var(--color-font); }
  &.tabActive {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
    color: var(--color-primary);
    font-weight: 600;
  }
}
.qrWrap {
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  gap: 10px;
}
.qrBox {
  flex: none;
  width: 190px;
  height: 190px;
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
.form, .accountSection { min-width: 0; }
.tip, .status, .empty {
  color: var(--color-font-label);
  font-size: 12px;
  line-height: 1.5;
}
.cookieInput {
  display: block;
  width: 100%;
  min-height: 110px;
  margin: 12px 0;
  padding: 8px;
  box-sizing: border-box;
  border: none;
  border-radius: @form-radius;
  resize: vertical;
  background: var(--color-primary-background);
  color: var(--color-font);
  outline: none;
  font: 12px/1.5 monospace;
  &:focus { background: var(--color-primary-background-hover); }
}
.primaryBtn { margin-left: auto; display: block; }
.accountBar, .selectionBar, .footer {
  display: flex;
  align-items: center;
  gap: 10px;
}
.accountBar { justify-content: space-between; flex-wrap: wrap; }
.accountName { min-width: 0; word-break: break-all; font-size: 13px; }
.accountActions { display: flex; gap: 6px; }
.selectionBar { justify-content: space-between; margin: 14px 0 8px; font-size: 12px; color: var(--color-font-label); }
.playlists {
  width: 100%;
  max-height: 40vh;
  min-height: 80px;
  overflow-y: auto;
  display: flex;
  flex-flow: column nowrap;
  gap: 4px;
  padding: 8px;
  box-sizing: border-box;
  border-radius: @radius-border;
  border: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent);
}
.playlist {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 34px;
  padding: 4px 8px;
  box-sizing: border-box;
  border-radius: 6px;
  &:hover { background: color-mix(in srgb, var(--color-font) 4%, transparent); }
  :global(.checkbox) { flex: 1 1 auto; min-width: 0; }
  :global(.label) { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .trackCount { flex: none; margin-left: auto; font-variant-numeric: tabular-nums; }
}
.trackCount { flex: none; color: var(--color-font-label); font-size: 11px; }
.footer { justify-content: space-between; flex-wrap: wrap; margin-top: 14px; }
.status { flex: auto; }
.error { margin-top: 10px; color: var(--color-danger, #d65b5b); font-size: 12px; line-height: 1.4; }

</style>
