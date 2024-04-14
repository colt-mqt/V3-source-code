import { isObject } from "@vue/shared";
import { mutableHandlers } from "./handlers";

export const enum ReactiveFlags {
  IS_REACTIVE = "__v__isReactive"
}
const reactiveMap = new WeakMap()

export function reactive(target) {
  // reactive 只能处理对象类型的数据
  if (!isObject(target)) return target

  // 做缓存，缓存采用映射表
  let existingProxy = reactiveMap.get(target) // 看一下这个对象是否被代理过
  if (existingProxy) return existingProxy

  if (target[ReactiveFlags.IS_REACTIVE]) {
    return target
  }
  let a = "1"

  const proxy = new Proxy(target, mutableHandlers)
  reactiveMap.set(target, proxy)

  // 如果对象被代理过，不能再代理
  // 1）vue3.0 会创建一个反向映射表 {代理的结果：原内容}
  // 2）如果对象被代理过，说明已经被 proxy 拦截过了
  return proxy
}

export function isReactive(value) {
  return value[ReactiveFlags.IS_REACTIVE]
}
