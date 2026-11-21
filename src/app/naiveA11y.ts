/**
 * naive-ui 的 ARIA 补齐层。
 *
 * 这些不是业务组件自己的问题，而是 naive-ui 2.38 的默认 DOM：
 *   - NCard 的 header 带 role="heading" 但漏了 aria-level；
 *   - NSlider 的 handle 带 role="slider" 但没有可访问名称；
 *   - NInputNumber 的加减按钮是纯图标按钮，没有 aria-label；
 *   - NModal 的 card 带 role="dialog"，但 preset card 不会自动把 title 变成名称。
 * 我们另外在业务侧显式补了 switch / dialog 的标签；这里兜住库自身无法通过 props 传递的部分。
 * 只补缺失属性，不覆盖业务已经写好的名称，也不改视觉。
 */

function squash(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function labelText(container: Element | null | undefined): string {
  if (!container) return ''
  const explicit = container.querySelector(
    '.ps-label, .n-form-item-label, .form-label, .field-label, label',
  )
  return squash(explicit?.textContent)
}

function patchHeadings(root: ParentNode): void {
  root.querySelectorAll('[role="heading"]:not([aria-level])').forEach((heading) => {
    heading.setAttribute('aria-level', '2')
  })
}

function patchSliders(root: ParentNode): void {
  root.querySelectorAll('[role="slider"]:not([aria-label]):not([aria-labelledby])').forEach((slider) => {
    const item = slider.closest('.n-slider')?.parentElement
      ?? slider.closest('.ps-item, .form-item, .n-form-item')
    const name = labelText(item)
    slider.setAttribute('aria-label', name || '数值滑块')
  })
}

function patchNumberButtons(root: ParentNode): void {
  root.querySelectorAll('.n-input-number').forEach((input) => {
    const buttons = [...input.querySelectorAll<HTMLButtonElement>('.n-input__suffix button')]
    if (buttons.length < 2) return
    const [decrease, increase] = [buttons[0], buttons[buttons.length - 1]]
    if (!decrease.getAttribute('aria-label')) decrease.setAttribute('aria-label', '减少数值')
    if (!increase.getAttribute('aria-label')) increase.setAttribute('aria-label', '增加数值')
  })
}

function patchDialogs(root: ParentNode): void {
  root.querySelectorAll('[role="dialog"]:not([aria-label]):not([aria-labelledby])').forEach((dialog) => {
    const title = squash(dialog.querySelector('.n-card-header__main, .n-card-header')?.textContent)
      || squash(dialog.querySelector('h1, h2, h3')?.textContent)
    dialog.setAttribute('aria-label', title || '对话框')
  })
}

export function patchNaiveA11y(root: ParentNode = document): void {
  patchHeadings(root)
  patchSliders(root)
  patchNumberButtons(root)
  patchDialogs(root)
}

let installed = false
let frame = 0

export function installNaiveA11y(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  patchNaiveA11y()
  const observer = new MutationObserver(() => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      patchNaiveA11y()
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
