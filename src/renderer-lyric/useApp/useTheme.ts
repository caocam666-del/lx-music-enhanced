import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { setting } from '@lyric/store/state'
import { onThemeChange } from '@lyric/utils/ipc'
import { RGB_Alpha_Shade } from '@common/theme/colorUtils'

export default () => {
  const rThemeChange = onThemeChange(({ params: setting }) => {
    window.setTheme(setting.theme.colors)
  })
  watch(() => [
    setting['desktopLyric.style.colorFollowDetail'],
    setting['desktopLyric.style.lyricUnplayColor'],
    setting['desktopLyric.style.lyricPlayedColor'],
    setting['desktopLyric.style.lyricShadowColor'],
  ], ([followDetail, unplayColor, playedColor, shadowColor]) => {
    // 歌词取色策略（用户明确要求）：
    //   默认「跟随详情页」—— 用详情页从封面取出的强调色 / 亮白
    //   用户手动在设置页改色 → colorFollowDetail 置 false，改用自己的颜色
    //   点「重置颜色」→ 恢复 true，重新与详情页同步
    //
    // 这两个变量是所有歌词布局（灵动岛 / 歌词条 / 横竖屏）的统一取色入口，
    // 所以在这里做一次解析，各布局直接 var(--color-lyric-*) 即可。
    const follow = followDetail !== false
    window.setLyricColor({
      '--color-lyric-unplay': follow
        ? 'var(--detail-font-bright, #f4f5f7)'
        : unplayColor,
      '--color-lyric-played': follow
        ? 'var(--detail-accent-bright, var(--detail-accent-color, #07c556))'
        : playedColor,
      '--color-lyric-shadow': follow
        ? 'var(--detail-lyric-shadow, none)'
        : shadowColor,
      '--color-lyric-shadow-font-mode': follow
        ? 'var(--detail-lyric-shadow, none)'
        : RGB_Alpha_Shade(0.49, shadowColor),
    })
  }, {
    immediate: true,
  })

  onBeforeUnmount(() => {
    rThemeChange()
  })
}
