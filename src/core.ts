import type { IoptsType } from './helper'
import {
  BULLETCLASS,
  BULLETTEMPCLASS,
  eventEntrust,
  getContainer,
  initBulletAnimate,
} from './helper'

// 基础配置
const defaultOptions: IoptsType = {
  trackHeight: 40,
  pauseOnHover: true,
  pauseOnClick: true,
  onStart: null,
  onEnd: null,
  duration: '10s',
  trackArr: [{ speed: 150 }, { speed: 130 }],
  speed: 100,
}

type ItrackStatus = 'running' | 'idle'
interface IBulletInfo {
  width: number
}

interface IQueue {
  item: string
  opts: IoptsType
}

export default class BulletJs {
  private ele: string | HTMLElement
  private options: IoptsType
  private targetPos: DOMRect = new DOMRect()

  private target: HTMLElement | null = null
  private tempContanier: HTMLElement | null = null
  private bulletInfo: IBulletInfo = { width: 0 }
  private bullets: HTMLElement[][] = []
  private tracks: ItrackStatus[] = []
  private queues: IQueue[] = []
  private targetW: number = 0
  private pauseArrs: HTMLElement[] = []
  private isAllPaused: boolean = false

  constructor(ele: string | HTMLElement, opts: Partial<IoptsType> = {}) {
    this.options = { ...defaultOptions, ...opts }
    this.ele = ele
    this.initScreen()
    this.initOpt()
    this.initTempContainer()
    this._addExtraEvent()
  }

  private initScreen(): void {
    if (typeof this.ele === 'string') {
      this.target = document.querySelector(this.ele)
      if (!this.target)
        throw new Error('The display target does not exist')
    }
    else if (this.ele instanceof HTMLElement) {
      this.target = this.ele
    }
    else {
      throw new TypeError('The display target of the barrage must be set')
    }
  }

  private initOpt(): void {
    const { trackHeight = 35 } = this.options
    if (!this.target)
      throw new Error('Target element not initialized')
    this.targetPos = this.target.getBoundingClientRect()
    const trackNum = Math.floor(this.targetPos.height / trackHeight)
    this.tracks = Array(trackNum).fill('idle')
    this.bullets = Array(trackNum)
      .fill([])
      .map(() => [])
    this.targetW = this.targetPos.width

    const { position } = getComputedStyle(this.target)
    if (position === 'static') {
      this.target.style.position = 'relative'
      this.target.style.overflow = 'hidden'
    }
    initBulletAnimate(this.targetW)
  }

  private initTempContainer(): void {
    this.tempContanier = document.createElement('div')
    this.tempContanier.classList.add(BULLETTEMPCLASS)
    document.body.appendChild(this.tempContanier)
  }

  public push(
    item: string,
    opts: Partial<IoptsType> = {},
    isSelf = false,
  ): number | string | undefined {
    if (this.isAllPaused)
      return
    const options = { ...this.options, ...opts }

    const canIndex = this._getTrackIndex()
    if (canIndex === -1) {
      if (isSelf)
        this.queues.push({ item, opts } as any)
    }
    else {
      const bulletContainer = this._getBulletItem(item, options, canIndex)
      this.bullets[canIndex].push(bulletContainer)
      this._render(bulletContainer, canIndex)
      this._addEvent(bulletContainer, canIndex, options)
      return bulletContainer.id
    }
  }

  private _getBulletItem(item: string, options: IoptsType, canIndex: number): HTMLElement {
    const bulletContainer = getContainer()
    bulletContainer.innerHTML = item
    if (!this.tempContanier)
      throw new Error('Temporary container not initialized')
    this.tempContanier.innerHTML = ''
    this.tempContanier.appendChild(bulletContainer)
    this.bulletInfo = { width: bulletContainer.offsetWidth }

    let duration = 0
    const speed = options.trackArr?.[canIndex]?.speed || options.speed
    if (speed)
      duration = (this.targetW + this.bulletInfo.width) / speed
    else duration = typeof options.duration === 'string' ? Number.parseFloat(options.duration) : 10

    bulletContainer.dataset.duration = `${duration}`
    if (bulletContainer)
      bulletContainer.style.animationDuration = `${duration}s`

    bulletContainer.remove()
    return bulletContainer
  }

  private _getTrackIndex(): number {
    // 计算每个轨道的当前负载
    const trackLoads = this.tracks.map((status, index) => {
      if (status === 'idle')
        return 0
      const trackBullets = this.bullets[index]
      const lastBullet = trackBullets[trackBullets.length - 1]
      if (!lastBullet)
        return 0

      const lastBulletRect = lastBullet.getBoundingClientRect()
      const progress = (lastBulletRect.right - this.targetPos.left) / this.targetW
      return 1 - progress // 越接近 1，说明轨道越空闲
    })

    // 找出负载最小的轨道
    let minLoadIndex = -1
    let minLoad = Number.POSITIVE_INFINITY
    for (let i = 0; i < trackLoads.length; i++) {
      if (trackLoads[i] < minLoad) {
        minLoad = trackLoads[i]
        minLoadIndex = i
      }
    }

    // 如果所有轨道都满了，返回 -1
    if (minLoadIndex === -1)
      return -1

    // 如果选中的轨道当前是空闲的，将其状态设置为 running
    if (this.tracks[minLoadIndex] === 'idle')
      this.tracks[minLoadIndex] = 'running'

    return minLoadIndex
  }

  private _checkTrack(item: HTMLElement): boolean {
    const itemPos = item.getBoundingClientRect()
    const progress = (itemPos.right - this.targetPos.left) / this.targetW

    // 如果弹幕已经完全进入屏幕，就允许在这个轨道上添加新的弹幕
    if (progress <= 0.8)
      return true

    // 否则，使用原来的逻辑
    if (this.options.speed || this.options.trackArr?.length) {
      return itemPos.left < this.targetPos.right
    }
    else {
      const duration = Number.parseFloat(item.dataset.duration || '0')
      const v1 = (this.targetW + itemPos.width) / duration
      const s2 = this.targetW + this.bulletInfo.width
      const t2 = duration
      const v2 = s2 / t2

      if (v2 <= v1)
        return true

      const t1 = (itemPos.left - this.targetPos.left) / v1
      const t2New = this.targetW / v2
      return t2New >= t1
    }
  }

  private _addEvent(bulletContainer: HTMLElement, canIndex: number, options: IoptsType): void {
    const { onStart, onEnd } = options
    bulletContainer.addEventListener('animationstart', () => {
      if (onStart)
        onStart.call(window, bulletContainer.id, this)
    })

    bulletContainer.addEventListener('animationend', () => {
      if (onEnd)
        onEnd.call(window, bulletContainer.id, this)
      this.bullets[canIndex] = this.bullets[canIndex].filter(v => v.id !== bulletContainer.id)
      if (!this.bullets[canIndex].length)
        this.tracks[canIndex] = 'idle'
      bulletContainer.style.willChange = 'auto'
      bulletContainer.remove()
    })
  }

  private _addExtraEvent(): void {
    if (!this.target)
      throw new Error('Target element not initialized')

    if (this.options.pauseOnClick) {
      eventEntrust(this.target, 'click', BULLETCLASS, (el: HTMLElement) => {
        const currStatus = el.style.animationPlayState
        if (currStatus === 'paused' && el.dataset.clicked) {
          el.dataset.clicked = ''
          this._toggleAnimateStatus(el, 'running')
        }
        else {
          el.dataset.clicked = 'true'
          this._toggleAnimateStatus(el, 'paused')
        }
      })
    }

    if (this.options.pauseOnHover) {
      eventEntrust(this.target, 'mouseover', BULLETCLASS, (el: HTMLElement) => {
        this._toggleAnimateStatus(el, 'paused')
      })

      eventEntrust(this.target, 'mouseout', BULLETCLASS, (el: HTMLElement) => {
        this._toggleAnimateStatus(el, 'running')
      })
    }
  }

  private _render = (container: HTMLElement, track: number): void => {
    if (this.isAllPaused || !this.target)
      return

    // 使用 DocumentFragment 来批量添加 DOM 元素
    const fragment = document.createDocumentFragment()
    container.dataset.track = `${track}`
    container.style.top = `${track * this.options.trackHeight}px`
    container.style.willChange = 'transform'
    container.style.left = '0'
    fragment.appendChild(container)

    // 使用 requestAnimationFrame 来优化视觉更新
    requestAnimationFrame(() => {
      this.target!.appendChild(fragment)
    })

    if (this.queues.length) {
      const obj = this.queues.shift()
      if (obj)
        this.push(obj.item, obj.opts, true)
    }
  }

  public getBulletsList(): HTMLElement[] {
    return this.bullets.reduce((acc, cur) => [...acc, ...cur], [])
  }

  private _toggleAnimateStatus = (
    el: HTMLElement | null,
    status: 'running' | 'paused' = 'paused',
  ): void => {
    if (el) {
      if (status === 'running') {
        el.style.animationPlayState = 'running'
        el.style.zIndex = '0'
        el.classList.remove('bullet-item-paused')
      }
      else {
        el.style.animationPlayState = 'paused'
        el.style.zIndex = '99999'
        el.classList.add('bullet-item-paused')
      }
      return
    }

    if (this.pauseArrs.length && status === 'paused')
      return
    this.pauseArrs = this.getBulletsList()
    this.pauseArrs.forEach((item) => {
      item.style.animationPlayState = status
    })
    this.pauseArrs = []
  }

  public pause(el: HTMLElement | null = null): void {
    this._toggleAnimateStatus(el, 'paused')
    if (el === null)
      this.isAllPaused = true
  }

  public resume(el: HTMLElement | null = null): void {
    this._toggleAnimateStatus(el, 'running')
    this.isAllPaused = false
  }
}
