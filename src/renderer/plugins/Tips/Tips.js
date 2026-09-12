import Tips from './Tips.vue'
import { createApp } from 'vue'

const addAutoCloseTimer = (instance, time) => {
  if (!time) return
  if (instance.autoCloseTimer) clearTimeout(instance.autoCloseTimer)
  instance.autoCloseTimer = setTimeout(() => {
    instance.cancel()
  }, time)
}
const clearAutoCloseTimer = instance => {
  if (!instance.autoCloseTimer) return
  clearTimeout(instance.autoCloseTimer)
  instance.autoCloseTimer = null
}

export default ({ position, message, autoCloseTime } = {}, props) => {
  if (!position) return
  let app = createApp(Tips, {
    afterLeave() {
      app.unmount()
      app = null
    },
  })

  let instance = app.mount(document.createElement('div'))

  // Tips实例挂载到刚创建的div
  // 属性设置
  instance.visible = true
  instance.message = message
  instance.position.top = position.top
  instance.position.left = position.left

  // 将Tips的DOM挂载到body上
  document.body.appendChild(instance.$el)

  instance.cancel = () => {
    // Luminous Harmonic: beforeClose 是可选的 — useUpdate 等调用方不传第二参数,
    // 这里直接抛 TypeError 会让 visible=false 永远执行不到, 提示卡死在屏幕上无法消失
    props?.beforeClose?.(instance)
    clearAutoCloseTimer(instance)
    instance.visible = false
    instance = null
  }

  instance.setTips = tips => {
    addAutoCloseTimer(instance, autoCloseTime)
    instance.message = tips
  }

  addAutoCloseTimer(instance, autoCloseTime)

  return instance
}

