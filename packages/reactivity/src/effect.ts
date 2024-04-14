export let activeEffect = undefined

function cleanupEffect(effect) {
  // 找到 deps 中的 set，清理掉里面的 effect
  let deps = effect.deps
  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(effect)
  }
}
export class ReactiveEffect {
  // 默认会将 fn 挂载到类的实例上
  constructor(private fn, public scheduler) { }
  parent = undefined
  active = true
  deps = [] // 我依赖了哪些列表[effect]
  run() {
    if (!this.active) {
      // 失活态默认调用 run 时 只是重新执行，不会发生依赖收集
      return this.fn()
    }
    // 执行 fn 之前把当前的 effect 放在全局上
    // 这样 fn 取属性的时候就可以访问到 effect
    try {
      this.parent = activeEffect
      activeEffect = this
      cleanupEffect(this)
      return this.fn()
    } finally {
      activeEffect = this.parent
      this.parent = undefined // 标记用完进行回收
    }
  }
  stop() {
    if (this.active) {
      this.active = false
      cleanupEffect(this)
    }
  }
}
export function effect(fn, options: any = {}) {
  // 创建一个响应式 effect，并且让 effect 执行
  const _effect = new ReactiveEffect(fn, options.scheduler)
  _effect.run()
  // 把 runner 方法直接给用户，用户可以去调用 effect 中定义的内容
  const runner = _effect.run.bind(_effect)
  runner.effect = _effect
  return runner
}
/* 
  一个属性对应多个 effect
  一个 effect 中属性执行多次 getter，只需要记录一次（去重）
  例如：{name: 'xm'}: 'name' -> [effect, effect]
  所以结构应该是：weakMap: map: Set(去重使用)
*/
const targetMap = new WeakMap()
export function track(target, key) {
  // 让这个对象上的属性 记录当前的 activeEffect
  if (activeEffect) {
    // 说明用户是在 effect 中使用的这个数据
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }

    // 如果有这个映射表来查找一下有没有这个属性
    let dep = depsMap.get(key)
    // 如果没有 Set 集合创建集合
    if (!dep) {
      depsMap.set(key, (dep = new Set()))
    }
    // 如果有则看一下 Set 中有没有这个 effect
    let shouldTrack = !dep.has(activeEffect)
    if (shouldTrack) {
      dep.add(activeEffect)
      activeEffect.deps.push(dep)
    }
  }
}

export function trigger(target, key, value, oldValue) {
  // 通过对象找到对应的属性 让这个属性对应的 effect 重新执行
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }

  let deps = depsMap.get(key)
  if (deps) {
    deps = [...deps]
    deps.forEach((effect) => {
      // 正在执行的 effect，不要多次执行
      let run = true
      let parent = activeEffect && activeEffect.parent
      while (parent && run) {
        run = (effect !== parent)
        parent = parent.parent ? parent.parent : null
      }
      if (effect !== activeEffect && run) {
        if (effect.scheduler) {
          effect.scheduler() // 用户传递了对应的更新函数，则调用此函数
        } else {
          effect.run()
        }
      }
    })
  }
}
// activeEffect => e1
// activeEffect => e2,e2.parent = e1
// activeEffect => e1,e1.parent = e2
// activeEffect => e2,e2.parent = e1