import { isObject } from "@vue/shared";
import { activeEffect, track, trigger } from "./effect";
import { ReactiveFlags, reactive } from "./reactive";

export const mutableHandlers = {
  // 这里的 receiver 就是 proxy
  get(target, key, receiver) {
    // 我们在使用 proxy 的时候要搭配 receiver 来使用，用来解决 this 问题
    // 取值的时候，让这个属性和 effect 产生关系

    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }
    // 如果取值的时候发现是对象，再次进行代理，返回代理后的结果
    if (isObject(target[key])) {
      return reactive(target[key])
    }
    const res = Reflect.get(target, key, receiver)
    // 做依赖收集，记录属性和当前 effect 的关系
    track(target, key)
    return res
  },
  set(target, key, value, receiver) { // 更新
    // 找到这个属性对应的 effect 让他执行
    let oldValue = target[key]
    const r = Reflect.set(target, key, value, receiver)

    if (oldValue !== target[key]) {
      trigger(target, key, value, oldValue)
    }
    return r
  }
}