
// watch api 用法很多，常见写法就是监控一个函数的返回值，根据返回值的变化触发对应的函数
// watch 可以传递一个响应式对象，可以监控到对象的变化触发回调

import { isFunction, isObject } from "@vue/shared";
import { isReactive } from "./reactive";
import { ReactiveEffect } from "./effect";

// = 深拷贝，seen 防止死循环
function traverse(value, seen = new Set()) {
  if (!isObject) {
    return value
  }
  if (seen.has(value)) {
    return value
  }
  seen.add(value)
  for (const key in value) {
    traverse(value[key], seen) // 访问了属性，触发 getter
  }
  return value
}
export function watch(source, cb) {
  // 1）source 是一个响应式对象
  // 2）source 是一个函数

  // effect + scheduler
  let getter
  if (isReactive(source)) {
    source = () => traverse(source)
  } else if (isFunction(source)) {
    getter = source
  }
  let oldValue
  // 里面的属性就会收集当前的 effect
  // 如果数据变化，会执行对应的 scheduler 方法
  const effect = new ReactiveEffect(getter, () => {
    const newVal = effect.run()
    cb(newVal, oldValue)
    oldValue = newVal
  })
  oldValue = effect.run()
  console.log(oldValue);

}