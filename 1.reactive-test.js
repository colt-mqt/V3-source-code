let person = {
  name: 'jw',
  get aliasName() {
    return '**' + this.name + '**'
  },
  set aliasName(value) {
    this.name = value
  }
}
const proxyPerson = new Proxy(person, {
  get(target, key, receiver) {
    console.log('取值', key)
    return Reflect.get(target, key, receiver)
    // return target[key]; // target是 person
  }
})

// 假如我在视图中使用 aliasName 这个变量，会有 aliasName 对应的页面，但是没有创造 name 和页面的关系
// 获取的时候，希望让 name 属性也触发 get
proxyPerson.aliasName // 只触发了 aliasName 获取操作，没有触发 name 操作
// console.log(proxyPerson.aliasName);

// 页面和数据是有对应关系的 数据变化了要更新视图
proxyPerson.name = 'xxx'
