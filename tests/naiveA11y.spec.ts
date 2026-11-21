// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { patchNaiveA11y } from '../src/app/naiveA11y'

/**
 * naive-ui ARIA 补齐层的最小回归：
 * 只验证「缺什么补什么、已有名称不覆盖」，不测视觉。
 */
describe('naiveA11y', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('给没有 aria-level 的 heading 补层级', () => {
    document.body.innerHTML = '<div role="heading"><div class="n-card-header__main" role="heading">标题</div></div>'
    patchNaiveA11y()
    for (const heading of document.querySelectorAll('[role="heading"]')) {
      expect(heading.getAttribute('aria-level')).toBe('2')
    }
  })

  it('用字段标签给 slider 补名称，已有 aria-label 不覆盖', () => {
    document.body.innerHTML = `
      <div class="ps-item">
        <div class="ps-label">日均工时 <b>10h</b></div>
        <div class="n-slider"><div role="slider"></div></div>
      </div>
      <div class="n-slider"><div role="slider" aria-label="已有名称"></div></div>
    `
    patchNaiveA11y()
    const sliders = document.querySelectorAll('[role="slider"]')
    expect(sliders[0].getAttribute('aria-label')).toBe('日均工时 10h')
    expect(sliders[1].getAttribute('aria-label')).toBe('已有名称')
  })

  it('给数字输入的加减按钮补名称', () => {
    document.body.innerHTML = `
      <div class="n-input-number">
        <div class="n-input__suffix">
          <button class="n-button">−</button>
          <button class="n-button">+</button>
        </div>
      </div>
    `
    patchNaiveA11y()
    const buttons = document.querySelectorAll('.n-input__suffix button')
    expect(buttons[0].getAttribute('aria-label')).toBe('减少数值')
    expect(buttons[1].getAttribute('aria-label')).toBe('增加数值')
  })

  it('用卡片标题给无名称 dialog 补名称', () => {
    document.body.innerHTML = `
      <div class="n-card" role="dialog">
        <div class="n-card-header"><div class="n-card-header__main">先看这里</div></div>
      </div>
    `
    patchNaiveA11y()
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('先看这里')
  })
})
