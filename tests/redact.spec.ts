import { describe, expect, it } from 'vitest'
import { bucketAmount, redactContext } from '../src/utils/redact'

describe('出站金额脱敏', () => {
  it('千元以上金额按 1000 元分档', () => {
    expect(bucketAmount(6843.7)).toBe('¥6000-6999')
    expect(bucketAmount(8969.7)).toBe('¥8000-8999')
    expect(bucketAmount(12000)).toBe('¥12000-12999')
  })

  it('千元以下金额按 5 元分档（时薪量级仍有相对关系）', () => {
    expect(bucketAmount(26.32)).toBe('¥25-30')
    expect(bucketAmount(21.79)).toBe('¥20-25')
    expect(bucketAmount(3)).toBe('¥0-5')
  })

  it('非法输入不产出误导性区间', () => {
    expect(bucketAmount(Number.NaN)).toBe('（金额未知）')
    expect(bucketAmount(-5)).toBe('（金额未知）')
  })

  it('redactContext 替换带千分位与小数金额，非金额文本原样保留', () => {
    const ctx = '城市=广州（广东）,工时=10h。月收入=¥6,843.70,成本=¥1,200.50,时薪=¥26.32。权益评分=72/100'
    const out = redactContext(ctx)
    expect(out).not.toContain('6,843.70')
    expect(out).not.toContain('1,200.50')
    expect(out).not.toContain('26.32')
    expect(out).toContain('¥6000-6999')
    expect(out).toContain('¥1000-1999')
    expect(out).toContain('¥25-30')
    expect(out).toContain('城市=广州（广东）')
    expect(out).toContain('权益评分=72/100')
  })

  it('无金额文本原样返回', () => {
    const text = '工时=10h,日单=30,月工作日=26天'
    expect(redactContext(text)).toBe(text)
  })
})
