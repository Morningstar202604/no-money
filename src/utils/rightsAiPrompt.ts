/**
 * 把“当前清单第 1 件 + 城市”变成一条可直接发送的问题。
 * 只负责措辞，不查政策、不补金额：AI 回答仍必须回到官方入口核验。
 */
export interface RightsAiPromptInput {
  cityName: string
  itemTitle: string
  identityLabel?: string
  situationLabel?: string
  itemDeadline?: string
}

export function buildRightsAiPrompt(input: RightsAiPromptInput): string {
  const city = input.cityName.trim() || '当地'
  const title = input.itemTitle.trim()
  if (!title) return ''

  let context = `我在${city}`
  if (input.identityLabel && input.identityLabel !== '不确定') {
    context += `，身份是${input.identityLabel}`
  }
  context += '。'
  const goal = input.situationLabel ? `我最近要解决“${input.situationLabel}”。` : ''
  const deadline = input.itemDeadline ? `清单里写的时限是“${input.itemDeadline}”。` : ''

  return `${context}${goal}我的清单第 1 件是「${title}」。${deadline}
请告诉我：要带哪些材料、线上和线下分别去哪办、多久内办完、最常见的坑。
只写有官方依据的内容；金额、文号、电话或链接不确定就直说“以当地最新公布为准”，不要编。如果我给的信息不够，先问我一个最关键的问题，不要替我假设。`
}
