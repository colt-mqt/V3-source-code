# VUE3 源码学习

## day01 - reactive

实现创建响应式对象 API - reactive

### 使用

使用 reactive 创建一个响应式对象

~~~js
const obj = { name: "jj", age: 20 }
const state = reactive(obj)
~~~

### 核心API - Proxy

* vue3 采用了 ES6 新增的 Proxy 来代理对象实现响应式

> 下例中：handler 的 get、set 中的 receiver 参数其实就是 proxy 本身
>
> recevier 在代理中起到至关重要的作用

~~~js
const handler = {
  get: function (target, property, receiver) {},
  set: function (target, property, value, receiver) {},
}
var p = new Proxy(target, handler) // receiver 是 p
~~~

### receiver 和 Reflect

> MDN 中说明：receiver 是一个Proxy 或者继承 Proxy 的对象

receiver 最主要的作用是用来**解决 this 问题**，为了方便理解，我们先来看一个例子

~~~ts
let person = {
  name: "jj",
  get aliasName() {
    return "*" + this.name + "*";
  },
  set aliasName(value) {
    this.name = value;
  },
};
const proxyPerson = new Proxy(person, {
  get(target, key, receiver) { // 取值
    return target[key]; // target是 person
  },
});

proxyPerson.aliasName; // 只触发了 aliasName 获取操作，没有触发 name 操作

// 页面和数据是有对应关系的 数据变化了要更新视图
proxyPerson.name = "xxx";

~~~

上面我们使用 Proxy 代理了 person

* 假如我在视图中使用 aliasName 这个变量，会有 aliasName 对应的页面，但是没有创造 name 和页面的关系

> 这意味着，我们执行 proxyPerson.aliasName 时只触发了 aliasName 获取操作，没有触发 name 操作

* 页面和数据是有对应关系的，当数据变化时我们要更新视图

  > proxyPerson.name = "xxx"，此时 name 改变，但是由于没有创造 name 和页面的关系，视图不会更新

为了解决这个问题，这个时候就需要用到 receiver 了，除此之外还用到一个新的 API - Reflect

> Reflect 是一个内置的对象，它提供拦截 JavaScript 操作的方法
>
> Reflect.get() 方法，如果`target`对象中指定了`get`，`receiver`则为`get`调用时的`this`值

所以 person 的代理改为以下方式

~~~TS
get(target, key, receiver) {
  console.log("取值", key);
  return Reflect.get(target, key, receiver);
},
~~~

处理完后，如果在 get 中 console 一下你会发现打印了两次，一次是读取 aliasName 一次是读取 name

### 实现 reactive

学习前面的知识后，我们就可以开始实现 reactive 了

~~~ts
function isObject(value) {
  return value !== null && typeof value === 'object'
}

const mutableHandlers = {
  // 这里的 receiver 就是 下面的 proxy
  get(target, key, receiver) {
    // 我们在使用 proxy 的时候要搭配 receiver 来使用，用来解决 this 问题

    if (isObject(target[key])) {
      // 如果取值的时候是对象，再次进行代理，返回代理后的结果
      return reactive(target[key])
    }
    return Reflect.get(target, key, receiver);
  },
  set(target, key, value, receiver) { // 更新
    return Reflect.set(target, key, value, receiver);
  }
}

function reactive(target) {
  if (!isObject(target)) return target
  
  // 缓存
  // ...
  

  
  // 如果对象被代理过，说明已经被 proxy 拦截过了
  // ...

  const proxy = new Proxy(target, mutableHandlers)
  return proxy
}
~~~

看到这里，是不是觉得 reactive 也就这么回事，其实不然，我们来考虑两个场景：

* 第一个，思考一下打印结果是什么（场景一）

~~~ts
const obj = { name: "jj", age: 20 };
const state1 = reactive(obj);
const state2 = reactive(obj)
console.log(state1 === state2);
~~~

答案是 false，虽然我们代理的对象相同，但是返回的 proxy 是不一样的

* 第二个，代理代理过的对象（场景二）

~~~ts
const obj = { name: "jj", age: 20 };
const state1 = reactive(obj);
const state3 = reactive(state1)
~~~

在 v3 中，已经代理过的对象不会再被代理

> 1. vue3.0 会创建一个反向映射表 {代理的结果：原内容}
>
> 2. 后面经过改进去除了反向映射表；如果对象被代理过，说明已经被 proxy 拦截过了，就不再进行代理

### 代理缓存 - WeakMap

场景一续集

* 在 vue3 中，上面打印结果是 true，原因是 v3 做了一个缓存机制，其实就是一个映射表

* 其中用到了 WeakMap 弱引用

~~~ts
// 缓存
const reactiveMap = new WeakMap()
let existingProxy = reactiveMap.get(target) // 看一下这个对象是否被代理过
if (existingProxy) return existingProxy
~~~

### ReactiveFlags

场景二续集

* 如果对象被代理过，说明已经被 proxy 拦截过了，就不再进行代理

~~~ts
// 如果对象被代理过，说明已经被 proxy 拦截过了
export const enum ReactiveFlags {
  IS_REACTIVE = "__v__isReactive"
}
if (target[ReactiveFlags.IS_REACTIVE]) {
  return target
}
~~~

### 总结

* reactive 只能处理对象类型的数据
* 代理过的对象会使用映射表进行缓存，防止重复代理
* 已经代理过的对象不会再被代理



## day02 - effect

### 使用

```js
const obj = { name: "xm", age: 20 };
const state = reactive(obj);
effect(() => {
  app.innerHTML = state.name + state.age;
  console.log("yes");
});
```

### 特性

* 所有的渲染都是基于 effect 来实现的

* 默认叫响应式 effect，数据变化后会重新执行此函数

* 属性会收集 effect（**数据的依赖收集**）

  > 数据会记录自己在哪个 effect 中使用了，稍后数据变化可以找到对应的 effect

### ReactiveEffect

* effect 方法会创建一个响应式 effect，并且让 effect 执行
* 其中使用到了 ReactiveEffect 类来处理我们的入参函数

这么说有点抽象，我们通过代码来理解

```ts
function effect(fn) {
  // 创建一个响应式 effect，并且让 effect 执行
  const _effect = new ReactiveEffect(fn)
  _effect.run()
}
```

```ts
let activeEffect = undefined
class ReactiveEffect {
  // 默认会将 fn 挂载到类的实例上
  constructor(private fn) { }
  run() {
    try {
      activeEffect = this
      return this.fn()
    } finally {
      activeEffect = null
    }
  }
}
```

可以看到，在 ReactiveEffect 之外定义了一个 activeEffect 全局变量，这个变量有什么作用呢？

1. 执行 fn 之前会把当前的 effect 放到 activeEffect 上
2. 这样 fn 中取属性的时候就可以访问到当前的 effect

比如在开篇的使用中取值 `state.name`时，我们可以在 getter 中访问到 activeEffect（也就是**当前属性对应的 effect**）

除此之外，最后会将 activeEffect 置空，大家思考一下，如果不这么操作会产生什么后果呢？我们来看一个例子

```ts
effect(() => {
  const name = state.name;
});
const myName = state.name
```

我们执行完 effect 后，activeEffect 会对应当前的 effect，当我们再进行属性读取时，发现 activeEffect 有值，此时问题就浮现了，我们会误判断当前属性对应到上一个 effect 中，其实这是不对的

### effect 嵌套问题

```ts
effect(() => {
  app.innerHTML = state.age;
  effect(() => {
    app.innerHTML = state.name;
  });
  app.innerHTML = state.address;
});
```

我们分析一下上面这个嵌套 effect

1. 第一个 effect，state 对应 e1
2. 第二个 effect，state 对应 e2；此时要注意，第二个执行完毕后 activeEffect 是被置空了的
3. 最后进行的`state.address`找不到对应的 effect

问题显而易见，那么 vue 是如何解决这个问题的呢？

vue2 和早期的 vue3 是使用栈来解决的，大致思想就是先入栈再执行，当前 effect 执行完毕后出栈

我们看到嵌套其实应该想到树结构，现在的 vue3 就是使用了树结构进行父子关系的维护（增加了一个 parent 标记）

```ts
class ReactiveEffect {
  // 默认会将 fn 挂载到类的实例上
  constructor(private fn) { }
  parent = undefined
  deps = [] // 依赖了哪些列表[effect]
  run() {
    try {
      this.parent = activeEffect
      activeEffect = this
      return this.fn()
    } finally {
      activeEffect = this.parent
      this.parent = undefined // 标记用完进行回收
    }
  }
}
```

我们来分析一下

1. 第一个 effect，activeEffect => e1
2. 第二个 effect，activeEffect => e2，e2.parent = e1；
3. 当第二个 effect 执行完毕后将 activeEffect 还原，activeEffect = e1

### 依赖收集 - track

所谓的依赖收集，其实就是记录属性和当前 effect 的关系，两者之间的关系：

1. **多对多** - 一个属性对应多个 effect，一个 effect 对应多个属性
2. 一个 effect 中相同属性执行多次 getter，只需要记录一次对应的 effect
3. 例：`{ name: 'xm' }: -> 'name': -> [effect, effect]`

这样，我们可以大致猜测一个存储的结构：`weakMap:=> Map: => Set`

根据结构梳理一下整个依赖收集的流程

1. 判断用户是否是在 effect 中使用的这个数据
2. 判断映射表（Map）是否存在当前属性
3. 判断集合（Set）中有没有这个 effect

了解了基本结构和流程后就可以进行代码编写了

```ts
const targetMap = new WeakMap()
export function track(target, key) {
  if (activeEffect) {
    // 1.说明用户是在 effect 中使用的这个数据
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }

    // 2.在映射表中查找一下有没有这个属性
    let dep = depsMap.get(key)
    // 如果没有 Set 集合创建集合
    if (!dep) {
      depsMap.set(key, (dep = new Set()))
    }

    // 3.看一下 Set 中有没有这个 effect
    let shouldTrack = !dep.has(activeEffect)
    if (shouldTrack) {
      dep.add(activeEffect)
      activeEffect.deps.push(dep)
    }
  }
}
```

### 使用 track

在我们使用 reactive 创建响应式对象时，在 Proxy 进行我们的依赖收集，如果不了解 reactive 原理，建议看上一篇文章[https://juejin.cn/post/7352090806453338124]

```ts
const mutableHandlers = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }
    const res = Reflect.get(target, key, receiver)
    console.log(activeEffect, key);
    // 做依赖收集，记录属性和当前 effect 的关系
    track(target, key)
    return res
  }
}
```

```ts
const obj = { name: "xm", age: 20 };
effect(() => {
  app.innerHTML = state.name + state.age;
});
```

我们最终输出的结构如下图所示：

![effect](/Users/maqingtao/Desktop/blog文档/effect.png)

### 依赖更新

当我们属性更改时，要触发视图更新，也就是让当前属性对应的 effect 重新执行

```ts
const mutableHandlers = {
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
```

```ts
function trigger(target, key, value, oldValue) {
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
      if (effect !== activeEffect) effect.run()
    })
  }
}
```

可能有同学注意到，我将获取到的 deps 进行了浅拷贝`deps = [...deps]`，这是为了后面执行依赖清理的时候使用，大家可以先忽略

到这一步，我们已经实现了视图更新，但是我们还要考虑两种场景：

```
effect(() => {
  state.age = Math.random();
  app.innerHTML = state.name + state.age;
});
```

```ts
effect(() => {
  app.innerHTML = state.age;
  effect(() => {
    state.age = Math.random();
    app.innerHTML = state.name;
  });
});
```

1. 当我们在 effect 中进行属性更新时，会再次触发 effect，
2. effect 中嵌套 effect，内层修改外层用到的属性，会触发外层，外层触发又会触发内层

这就造成了死循环，我们需要优化一下这种场景，其实就是做一层判断，正在执行的 effect 或者当前 activeEffect 的 parent 等于当前的 effect，不执行

```ts
dep && dep.forEach((effect) => {
  let run = true
  let parent = activeEffect && activeEffect.parent
  while (parent && run) {
    run = (effect !== parent)
    parent = parent.parent ? parent.parent : null
  }
  if (effect !== activeEffect && run) effect.run()
})
```

### 依赖清理

为什么要进行依赖清理，我们先来看一种场景

```ts
const obj = { name: "xm", age: 20, flag: true };
const state = reactive(obj);

effect(() => {
  console.log("触发");
  app.innerHTML = state.flag ? state.name : state.age;
});

setTimeout(() => {
  state.flag = false;
  setTimeout(() => {
    console.log("修改name不应该触发effect");
    state.name = "gx";
    state.age = 30;
  }, 1000);
}, 1000);
```

以上例子中：

1. 使用 flag 来决定展示 name 还是 age
2. 当我们修改 flag 后再进行 name 的修改， 原则上不应该触发 effect

> 此时 name 属性并没有使用到，所以更改 name 属性不应该触发 effect

针对这种情况，我们就需要进行依赖的清理，也就是在我们执行 effect 之前进行 clean

```ts
function cleanupEffect(effect) {
  // 找到 deps 中的 set，清理掉里面的 effect
  let deps = effect.deps
  for(let i = 0; i < deps.length; i++) {
    deps[i].delete(effect)
  }
}
class ReactiveEffect {
  constructor(private fn) { }
  parent = undefined
  deps = [] // 我依赖了哪些列表[effect]
  run() {
    try {
      this.parent = activeEffect
      activeEffect = this
      cleanupEffect(this) // 依赖清理
      return this.fn()
    } finally {
      activeEffect = this.parent
      this.parent = undefined
    }
  }
}
```

> 1. `flag = true` => track收集flag和name；activeEffect中的`deps: [Set(effect), Set(effect)]`
> 2. 修改 `flag = false` => 触发trigger执行 effect.run清空依赖：循环 deps 删除每个 Set 中对应的effect，name对应的Set中就不存在对应的effect => 触发track收集flag和age => 修改 name 触发 trigger，没有对应的effect不执行 => 修改 age 触发 trigger，Set中有对应的effect，执行effect.run

大家还记不记得，依赖更新中获取到 deps 执行前，我进行了一层浅拷贝，思考一下，为什么要做这个操作呢？

```ts
let deps = depsMap.get(key)
if (deps) {
  deps = [...deps]
  deps.forEach((effect) => {
    if (effect !== activeEffect) effect.run()
  })
}
```

我们来看一段代码：

```ts
let a = 1;
let s = new Set([a]);

s.forEach((item) => {
  s.delete(item);
  s.add(item);
  console.log("kill");
});
```

可以看到，我们先进行了删除再添加到操作，最终导致的结果就是无限循环，因为我们添加后 s 是一直在增加的所以会一直循环

我们再回过头来看，

1. 我们先执行 effect.run()，执行 effect 之前会进行 依赖清理 `cleanupEffect => deps[i].delete(effect)`
2. 执行 effect，触发 state 的 get 进入到依赖收集 track
3. 在 track 中会进行 effect 的收集`activeEffect.deps.push(dep)`

这个过程中会先删除再添加，就出现无限循环的问题了，这也是我们为什么要进行浅拷贝的原因

### runner

根据官方，effect 函数会返回一个 runner，使得用户可以调用 effect 中定义的内容，effect 函数完整代码：

```ts
export function effect(fn, options: any = {}) {
  // 创建一个响应式 effect，并且让 effect 执行
  const _effect = new ReactiveEffect(fn, options.scheduler)
  _effect.run()
  // 把 runner 方法直接给用户，用户可以去调用 effect 中定义的内容
  const runner = _effect.run.bind(_effect)
  runner.effect = _effect
  return runner
}
```

我们先了解两个东西：

1. effect 函数会接收第二个参数 options
2. runner 中有一个 effect 属性

再来看一个例子：

```ts
const runner = effect(
  () => {
    console.log('runner')
    app.innerHTML = state.name
  }
)
setTimeout(() => {
  state.name = 'gx' // 数据变化自动更新
}, 1000)
runner() // 2 自己决定何时更新
```

1. 默认情况下是自动更新，数据变化执行 effect
2. 使用 runner 可以自己决定何时更新

那么，有没有一种**数据变化但是不更新，由用户决定何时更新**的方法呢？答案是肯定的，它就隐藏在 effect 函数第二个参数 options 中：

```ts
const runner = effect(
  () => {
    console.log('runner')
    app.innerHTML = state.name
  },
  {
    scheduler: () => {
      // 用户自己决定更新
      setTimeout(() => {
        runner()
      })
    }
  }
)
```

当我们存在 scheduler 属性时，数据变化后不执行 effect ，而是执行我们的 scheduler 函数，其实和**组件异步渲染**的原理是一样的

### 实现 scheduler

其实实现 scheduler 很简单，我们只需要添加一点代码即可

```ts
class ReactiveEffect {
  constructor(private fn, public scheduler) { }
}

function effect(fn, options: any = {}) {
  const _effect = new ReactiveEffect(fn, options.scheduler)
}

function trigger(target, key, value, oldValue) {
  // ...
  deps.forEach((effect) => {
    // ...
    if (effect !== activeEffect && run) {
        if (effect.scheduler) {
          effect.scheduler() // 用户传递了对应的更新函数，则调用此函数
        } else {
          effect.run()
        }
      }
  })
}
```

### 停止 effect 响应

上面我们说到，执行 effect 后会返回一个 runner 让用户可以调用内部定义的方法，我们来实现一下停止 effect 响应的 api - stop

```js
const runner = effect(
  () => {
    console.log('runner')
    app.innerHTML = state.name
  }
)
// 停止 effect 的响应能力，不再收集依赖
runner.effect.stop()
setTimeout(() => {
  state.name = 'gx' // 不会再执行 effect
}, 1000)
```

当我们执行`runner.effect.stop()`后，我们再更改属性也不会执行我们的 effect，因为这个时候依赖已经被清理掉了

要实现这个 api，我们需要知道当前 effect 的状态并且及时清理依赖，话不多说，由于比较简单直接上代码：

```ts
export class ReactiveEffect {
  constructor(private fn, public scheduler) { }
  parent = undefined
  active = true // 状态标记
  deps = []
  run() {
    if (!this.active) {
      // 失活态默认调用 run 时 只是重新执行，不会发生依赖收集
      return this.fn()
    }
    try {
      this.parent = activeEffect
      activeEffect = this
      cleanupEffect(this)
      return this.fn()
    } finally {
      activeEffect = this.parent
      this.parent = undefined
    }
  }
  stop() {
    if (this.active) {
      this.active = false
      cleanupEffect(this)
    }
  }
}
```



## day-03 - watch

### 使用

```ts
watch(
  // state,
  () => state.name,
  (newVal, oldVal) => {
    console.log('数据变化了', newVal, oldVal)
  },
  { flush: 'sync' } // 同步
)
state.name = 'gx'
console.log('数据变化outer')
```

### 分析

* 三个参数：

> source：一个响应式对象或者函数
>
> cb：回调函数
>
> options：自定义参数

### 工具函数

```ts
// 深拷贝，seen 防止死循环
function traverse(value, seen = new Set()) {
  if (!isObject) { // 判断是否是对象
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
// 判断是否是响应式对象
export function isReactive(value) {
  return value[ReactiveFlags.IS_REACTIVE]
}
// 判断是否是函数
export function isFunction(value) {
  return typeof value === 'function'
}
```

### 实现

```ts
export function dowatch(source, cb, options) {
  // effect + scheduler
  let getter
  if (isReactive(source)) {
    source = () => traverse(source)
  } else if (isFunction(source)) {
    getter = source
  }
  let oldValue
  // 里面的属性会收集当前的 effect
  // 如果数据变化，会执行对应的 scheduler 方法

  const scheduler = () => {
    if (cb) {
      const newVal = effect.run()
      cb(newVal, oldValue)
      oldValue = newVal
    }
  }
  const effect = new ReactiveEffect(getter, scheduler)
  oldValue = effect.run()
}

```

