import { Pinia, PiniaPlugin, setActivePinia, piniaSymbol } from './rootStore'
import { ref, App, markRaw, effectScope, isVue2, Ref } from 'vue-demi'
import { registerPiniaDevtools, devtoolsPlugin } from './devtools'
import { USE_DEVTOOLS } from './env'
import { StateTree, StoreGeneric } from './types'

/**
 * 创建一个新的 Pinia 实例
 * Pinia实例是Pinia的核心，它包含了状态树和插件。
 */
export function createPinia(): Pinia {
  // vue的api https://cn.vuejs.org/api/reactivity-advanced.html#effectscope
  // 创建一个执行作用域，收集副作用，后面使用scope.stop释放副作用
  const scope = effectScope(true)
  // NOTE: here we could check the window object for a state and directly set it
  // if there is anything like it with Vue 3 SSR
  // state
  const state = scope.run<Ref<Record<string, StateTree>>>(() =>
    ref<Record<string, StateTree>>({})
  )!

  let _p: Pinia['_p'] = []
  // plugins added before calling app.use(pinia)
  let toBeInstalled: PiniaPlugin[] = []

  // 将一个对象标记为不可被转为代理。返回该对象本身。
  const pinia: Pinia = markRaw({
    // TODO
    install(app: App) {
      // this allows calling useStore() outside of a component setup after
      // installing pinia's plugin
      setActivePinia(pinia)
      if (!isVue2) {
        pinia._a = app
        app.provide(piniaSymbol, pinia)
        app.config.globalProperties.$pinia = pinia
        /* istanbul ignore else */
        if (USE_DEVTOOLS) {
          registerPiniaDevtools(app, pinia)
        }
        toBeInstalled.forEach((plugin) => _p.push(plugin))
        toBeInstalled = []
      }
    },

    // Pinia插件
    use(plugin) {
      if (!this._a && !isVue2) {
        toBeInstalled.push(plugin)
      } else {
        _p.push(plugin)
      }
      return this
    },
    // 已安装插件列表
    _p,
    // vue实例
    // it's actually undefined here
    // @ts-expect-error
    _a: null,
    // 执行作用域
    _e: scope,
    // TODO
    _s: new Map<string, StoreGeneric>(),
    // 数据存在这里
    state,
  })

  // pinia devtools rely on dev only features so they cannot be forced unless the dev build of Vue is used. Avoid old browsers like IE11.
  // 这里的意思是，如果是开发环境，则使用devtoolsPlugin，否则不使用。
  if (USE_DEVTOOLS && typeof Proxy !== 'undefined') {
    pinia.use(devtoolsPlugin)
  }

  return pinia
}

/**
 * Dispose a Pinia instance by stopping its effectScope and removing the state, plugins and stores. This is mostly
 * useful in tests, with both a testing pinia or a regular pinia and in applications that use multiple pinia instances.
 * 销毁一个 Pinia 实例
 *  停止响应性
    清空 stores
    重置插件
    重置 state
    将 app 引用设为 null
 * 
 */
export function disposePinia(pinia: Pinia) {
  pinia._e.stop()
  pinia._s.clear()
  pinia._p.splice(0)
  pinia.state.value = {}
  // @ts-expect-error: non valid
  pinia._a = null
}
