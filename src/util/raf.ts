// 定义计时器类型，可以是 'timeout' 或 'interval'
type TimerType = 'timeout' | 'interval'

// 定义计时器 ID 映射接口，使用 Map 来存储 timeout 和 interval 的 ID
interface TimerIdMap {
  timeout: Map<symbol, number>
  interval: Map<symbol, number>
}

export default class RAF {
  // 私有属性，用于存储所有的计时器 ID
  private _timerIdMap: TimerIdMap

  constructor() {
    // 在构造函数中明确初始化 _timerIdMap
    // 使用 Map 对象来存储计时器 ID，提高性能和类型安全性
    this._timerIdMap = {
      timeout: new Map(),
      interval: new Map(),
    }
  }

  // 核心方法：运行计时器
  private run(type: TimerType = 'interval', cb: () => void, interval: number = 16.7): symbol {
    const now = Date.now
    let stime = now()
    let etime = stime
    // 使用 Symbol 作为唯一的计时器标识
    const timerSymbol = Symbol('timer')

    const loop = (): void => {
      this.setIdMap(timerSymbol, type, loop)
      etime = now()
      if (etime - stime >= interval) {
        if (type === 'interval') {
          // 对于 interval，重置开始时间
          stime = now()
          etime = stime
        }
        cb()
        if (type === 'timeout') {
          // 对于 timeout，执行后清除
          this.clearTimeout(timerSymbol)
        }
      }
    }

    this.setIdMap(timerSymbol, type, loop)
    return timerSymbol
  }

  // 设置计时器 ID 映射
  private setIdMap(timerSymbol: symbol, type: TimerType, loop: () => void): void {
    const id = requestAnimationFrame(loop)
    // 使用 Map 的 set 方法存储计时器 ID
    this._timerIdMap[type].set(timerSymbol, id)
  }

  // 模拟 setTimeout
  setTimeout(cb: () => void, interval: number): symbol {
    return this.run('timeout', cb, interval)
  }

  // 清除 timeout
  clearTimeout(timer: symbol): void {
    // 使用 Map 的 get 方法获取计时器 ID
    const id = this._timerIdMap.timeout.get(timer)
    if (id !== undefined) {
      cancelAnimationFrame(id)
      // 使用 Map 的 delete 方法删除计时器 ID
      this._timerIdMap.timeout.delete(timer)
    }
  }

  // 模拟 setInterval
  setInterval(cb: () => void, interval: number): symbol {
    return this.run('interval', cb, interval)
  }

  // 清除 interval
  clearInterval(timer: symbol): void {
    // 使用 Map 的 get 方法获取计时器 ID
    const id = this._timerIdMap.interval.get(timer)
    if (id !== undefined) {
      cancelAnimationFrame(id)
      // 使用 Map 的 delete 方法删除计时器 ID
      this._timerIdMap.interval.delete(timer)
    }
  }
}
