<template>
  <div>
    <!-- Header -->
    <n-card title="权益补偿计算器" class="card">
      <FoldCard title="测算依据与用工关系前提（务必先读）">
        <p class="desc">
          依据《劳动合同法》《工伤保险条例》《劳动法》及人社部发〔2021〕56号等现行规定测算；
          一次性工伤医疗/就业补助金的月数由省级政府规定，<b>当前城市为{{ store.rule?.cityName ?? '未选择' }}（{{ province || '未知省份' }}）</b>，
          {{ province === '广东' ? '按《广东省工伤保险条例》（2019修正）第34条口径给出。' : '本产品只内置广东口径，你所在省不估算该项，页面会提示以本省实施办法为准。' }}
          合计仅计入可直接主张项，需行政责令、劳动关系认定等前置条件的金额单列。所有结果不构成法律意见，实际维权请咨询12348法律援助热线或当地工会法律援助。
        </p>
        <n-alert type="warning" :show-icon="true" style="margin-top: 8px">
          多数外卖骑手与平台被认定为"不完全符合确立劳动关系情形"，此时本页以劳动关系为前提的项目（加班费、二倍工资、违法解除赔偿金、工伤保险待遇）可能全部不适用，需改走民事服务合同/侵权路径。请先确认用工关系定性。
        </n-alert>
      </FoldCard>
    </n-card>

    <!-- 维权现实核查：先看概率，再谈金额 -->
    <n-card class="card" style="margin-top: 12px">
      <FoldCard
        title="维权现实核查 — 先说真话，再算金额"
        :summary="conditionalSummary ? `条件项 ${conditionalSummary.count} 笔 / ¥${conditionalSummary.total.toLocaleString()}` : '7 条硬事实'"
      >
        <n-alert v-if="conditionalSummary" type="warning" :show-icon="true" style="margin-bottom: 12px">
          本情景中，需要前置条件才成立的「条件项」共 {{ conditionalSummary.count }} 笔、合计 ¥{{ conditionalSummary.total.toLocaleString() }}。
          在劳动关系未认定、行政程序未启动之前，它们大概率不会实际到手——下方第 1、2 条说的就是这件事。
        </n-alert>
        <RealityList :facts="rightsFacts" />
      </FoldCard>
    </n-card>

    <!-- Scenario selector -->
    <n-card title="选择侵权场景" class="card" style="margin-top: 12px">
      <!-- 场景卡必须是真按钮：此前是可点击 div，键盘用户完全无法切换场景，
           读屏也拿不到「当前选中」状态 -->
      <div class="scenario-grid" role="group" aria-label="侵权场景">
        <button
          v-for="s in scenarios"
          :key="s.id"
          type="button"
          :class="['scenario-card', { active: currentScene === s.id }]"
          :aria-pressed="currentScene === s.id"
          @click="selectScene(s.id)"
        >
          <span class="sc-icon">{{ s.icon }}</span>
          <span class="sc-name">{{ s.name }}</span>
          <span class="sc-basis">{{ s.legalBasis }}</span>
        </button>
      </div>
    </n-card>

    <!-- Calculator forms -->
    <n-grid :x-gap="12" cols="1 m:2" responsive="screen" style="margin-top: 12px">
      <n-gi>
        <n-card :title="activeScene.name + ' — 参数输入'" class="card">
          <!-- Wage arrears -->
          <div v-if="currentScene === 'wage'" class="form-section">
            <div class="form-item">
              <label>欠薪月数</label>
              <n-input-number v-model:value="form.wage.months" :min="1" :max="24" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>月均应发报酬 (元)</label>
              <n-input-number v-model:value="form.wage.monthly" :min="0" :step="500" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>被克扣比例</label>
              <n-slider v-model:value="form.wage.percent" :min="10" :max="100" :step="10" :format-tooltip="(v:number) => v + '%'" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>已连续工作月数（用于二倍工资）</label>
              <n-input-number v-model:value="form.wage.tenureMonths" :min="1" :max="24" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>是否已签书面合同</label>
              <n-switch v-model:value="form.wage.hasContract" @update:value="calc()" />
              <p class="form-note">{{ form.wage.hasContract ? '有书面合同' : '无书面合同 — 可另主张二倍工资差额（第2个月起，最多11个月）' }}</p>
            </div>
            <div class="form-item">
              <label>是否已以欠薪为由书面解除</label>
              <n-switch v-model:value="form.wage.forcedQuit" @update:value="calc()" />
              <p class="form-note">《劳动合同法》第38条要求先送达解除通知，才能主张第46条经济补偿</p>
            </div>
          </div>

          <!-- Workplace injury -->
          <div v-if="currentScene === 'injury'" class="form-section">
            <div class="form-item">
              <label>伤残等级</label>
              <!-- 1-10 级必须全部可选：服务层对 1-4 级有「一次性补助金 + 按月伤残津贴」
                   的完整分支，此前下拉把「六级及以上」压成 6，1-4 级逻辑在生产路径永远走不到 -->
              <n-select v-model:value="form.injury.level" :options="[
                { label: '未构成伤残（医疗费 + 误工费）', value: 0 },
                { label: '一级伤残（最重）', value: 1 },
                { label: '二级', value: 2 },
                { label: '三级', value: 3 },
                { label: '四级', value: 4 },
                { label: '五级', value: 5 },
                { label: '六级', value: 6 },
                { label: '七级', value: 7 },
                { label: '八级', value: 8 },
                { label: '九级', value: 9 },
                { label: '十级伤残（最轻）', value: 10 },
              ]" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>医疗费（已发生，元）</label>
              <n-input-number v-model:value="form.injury.medical" :min="0" :step="1000" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>停工留薪期月数</label>
              <n-input-number v-model:value="form.injury.leaveMonths" :min="0" :max="24" style="width:100%" @update:value="calc()" />
              <p class="form-note">一般不超过12个月；伤情严重经市级劳动能力鉴定委员会确认可延长不超过12个月</p>
            </div>
            <div class="form-item">
              <label>本人月平均工资 (元)</label>
              <n-input-number v-model:value="form.injury.income" :min="0" :step="500" style="width:100%" @update:value="calc()" />
              <p class="form-note">按缴费工资口径，低于全省社平60%或高于300%时自动封顶保底（区间 ¥{{ pensionFloor.toLocaleString() }} – ¥{{ pensionCeil.toLocaleString() }}）<SourceTag source-key="pension" /></p>
            </div>
            <div class="form-item">
              <label>住院伙食补助 元/天（当地标准，0=不计）</label>
              <n-input-number v-model:value="form.injury.mealPerDay" :min="0" :step="10" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>护理费 元/天（当地标准，0=不计）</label>
              <n-input-number v-model:value="form.injury.nursingPerDay" :min="0" :step="10" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>已参加工伤保险</label>
              <n-switch v-model:value="form.injury.hasInsurance" @update:value="calc()" />
              <p class="form-note">{{ form.injury.hasInsurance ? '已参保：基金支付部分待遇' : '未参保：第62条—全部待遇由用人单位按条例标准支付' }}</p>
            </div>
            <p class="form-note">注：平台按单缴费的职业伤害保障试点待遇项目少于工伤保险，本页按工伤保险口径计算，若实际走职伤渠道需重新核算。</p>
          </div>

          <!-- Wrongful termination -->
          <div v-if="currentScene === 'dismiss'" class="form-section">
            <div class="form-item">
              <label>工作年限</label>
              <n-input-number v-model:value="form.dismiss.years" :min="0" :max="20" :step="0.5" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>月均工资 (元)</label>
              <n-input-number v-model:value="form.dismiss.monthly" :min="0" :step="500" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>解约性质</label>
              <n-select v-model:value="form.dismiss.type" :options="[
                { label: '无理由辞退（违法解除 2N）', value: 'wrongful' },
                { label: '第40条情形未提前30天通知（N+1）', value: 'no_notice' },
                { label: '怀孕/产假/哺乳期内被辞', value: 'protected' },
                { label: '因举报违规被辞（报复解雇）', value: 'retaliatory' },
              ]" @update:value="calc()" />
            </div>
            <div v-if="form.dismiss.type === 'protected'" class="form-item">
              <label>主张的工资损失月数（0=不计）</label>
              <n-input-number v-model:value="form.dismiss.pregnancyMonths" :min="0" :max="24" style="width:100%" @update:value="calc()" />
              <p class="form-note">哺乳期满通常为婴儿满1周岁。广东裁审对"整个三期工资"是否支持口径不一，故列为条件项</p>
            </div>
            <p class="form-note">月工资超过全省社平300%时，经济补偿基数按300%计且年限封顶12年。</p>
          </div>

          <!-- Platform algorithm violation -->
          <div v-if="currentScene === 'algorithm'" class="form-section">
            <div class="form-item">
              <label>侵权类型</label>
              <n-select v-model:value="form.algo.type" :options="[
                { label: '不合理派单（强制远距离/超时）', value: 'unfair_dispatch' },
                { label: '恶意降价/压低单价', value: 'price_suppress' },
                { label: '违规扣分导致收入损失', value: 'unfair_penalty' },
                { label: '封号/冻结账户', value: 'account_ban' },
                { label: '强制二选一排他', value: 'exclusivity' },
              ]" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>月均收入损失 (元)</label>
              <n-input-number v-model:value="form.algo.loss" :min="0" :step="500" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>持续时间（月）</label>
              <n-input-number v-model:value="form.algo.duration" :min="1" :max="24" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>已确认存在劳动关系</label>
              <n-switch v-model:value="form.algo.hasLaborRelation" @update:value="calc()" />
              <p class="form-note">无劳动关系时，算法争议通常只能按民事服务合同/侵权路径主张，仲裁一般不受理</p>
            </div>
            <p class="form-note">本页所有金额均为估算，算法规则造成的收入差额举证难度大，实际胜诉金额往往低于估算值。</p>
          </div>

          <!-- Overwork -->
          <div v-if="currentScene === 'overwork'" class="form-section">
            <div class="form-item">
              <label>小时工资基数 (元/h)</label>
              <n-input-number v-model:value="form.overwork.hourlyBase" :min="0" :step="5" style="width:100%" @update:value="calc()" />
              <p class="form-note">不得低于非全日制小时最低工资 ¥{{ effectiveMinHourly || '—' }}/h <SourceTag source-key="minimumWage" /></p>
            </div>
            <div class="form-item">
              <label>工作日延时小时/月</label>
              <n-input-number v-model:value="form.overwork.weekdayHours" :min="0" :max="200" :step="4" style="width:100%" @update:value="calc()" />
              <p class="form-note">《劳动法》第41条上限为每月36小时</p>
            </div>
            <div class="form-item">
              <label>休息日加班小时/月</label>
              <n-input-number v-model:value="form.overwork.weekendHours" :min="0" :max="200" :step="4" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>法定节假日加班小时/月</label>
              <n-input-number v-model:value="form.overwork.holidayHours" :min="0" :max="100" :step="2" style="width:100%" @update:value="calc()" />
            </div>
            <div class="form-item">
              <label>涉及月份</label>
              <n-input-number v-model:value="form.overwork.months" :min="1" :max="24" style="width:100%" @update:value="calc()" />
            </div>
            <p class="form-note">不再按"未付加班费总额"折算固定比例，改为按 1.5/2/3 倍分别计算，避免凭空丢失或夸大金额。</p>
          </div>

          <n-divider style="margin:10px 0" />
          <n-button @click="resetForm()" size="small" ghost>重置参数</n-button>
        </n-card>
      </n-gi>

      <!-- Results -->
      <n-gi>
        <n-card title="可主张补偿明细" class="card">
          <div v-if="!result" class="result-empty">
            填写左侧参数后自动计算补偿金额
          </div>
          <div v-else class="result-section">
            <!-- 首屏用的是预填示例值：不加标识的话，用户会把示例金额当成自己的可主张金额 -->
            <n-alert v-if="isExample" type="info" :show-icon="true" style="margin-bottom: 10px">
              下面是按<strong>示例参数</strong>算出的金额，不是你的情况。请把左侧各项改成你的实际数字，
              金额才会更新并可用于文书生成。
            </n-alert>
            <div class="result-total">
              <span>{{ isExample ? '示例可直接主张合计' : '可直接主张合计' }}</span>
              <strong>¥{{ result.total.toLocaleString() }}</strong>
            </div>
            <div v-if="result.conditionalTotal > 0" class="result-conditional">
              <span>条件项合计（需行政责令 / 劳动关系认定 / 解除终止等前置成立，<strong>不并入上方合计</strong>）</span>
              <strong>¥{{ result.conditionalTotal.toLocaleString() }}</strong>
            </div>
            <!-- 按月给付项单列：把「每月津贴」写进一次性合计会让用户误读为到手金额 -->
            <div v-if="monthlyItems.length > 0" class="result-monthly">
              <span>按月给付（持续至退休，<strong>不计入上述一次性合计</strong>）</span>
              <strong>¥{{ monthlyTotal.toLocaleString() }}/月</strong>
            </div>
            <n-table :bordered="false" :single-line="true" size="small" :style="{ marginBottom: '12px' }">
              <thead>
                <tr><th>项目</th><th style="text-align:right">金额</th></tr>
              </thead>
              <tbody>
                <tr v-for="(item, i) in result.items" :key="i">
                  <td>
                    <n-tag v-if="item.kind === 'conditional'" size="tiny" type="warning" :bordered="false" class="kind-tag">条件</n-tag>
                    <n-tag v-else-if="item.kind === 'info'" size="tiny" :bordered="false" class="kind-tag">说明</n-tag>
                    {{ item.name }}
                    <n-tooltip v-if="item.note" trigger="hover" placement="right">
                      <template #trigger><span class="info-icon">ⓘ</span></template>
                      {{ item.note }}
                    </n-tooltip>
                  </td>
                  <td style="text-align:right">
                    <span v-if="item.amount > 0">¥{{ item.amount.toLocaleString() }}<template v-if="item.period === 'monthly'"><small>/月</small></template></span>
                    <span v-else class="text-muted">—</span>
                  </td>
                </tr>
              </tbody>
            </n-table>

            <n-divider style="margin:8px 0" />

            <div class="legal-refs">
              <div class="lr-title">法律依据</div>
              <div v-for="(ref, i) in result.legalRefs" :key="i" class="lr-item">
                《{{ ref.law }}》第{{ ref.article }}条 — {{ ref.summary }}
              </div>
            </div>

            <n-divider style="margin:8px 0" />

            <div class="action-buttons">
              <n-button text type="primary" @click="goTab('document')">生成法律文书 →</n-button>
              <n-button text @click="goTab('guide')">维权步骤</n-button>
            </div>
          </div>
        </n-card>

        <n-card title="维权途径与时效" class="card" style="margin-top: 12px">
          <n-steps :current="0" size="small" vertical>
            <n-step title="① 固定证据" description="截图工资单/扣款/派单记录，越早越好" />
            <n-step title="② 平台申诉" description="APP工单/客服 — 保留书面回复" />
            <n-step title="③ 行政投诉" description="拨打 12333 或向劳动监察大队举报" />
            <n-step title="④ 劳动仲裁" description="向劳动人事争议仲裁委申请（免费）" />
            <n-step title="⑤ 法院起诉" description="不服仲裁15日内向基层法院起诉" />
          </n-steps>
          <div class="hotline-bar">
            <span>12348 <b>法律援助</b></span>
            <span>12333 <b>人社投诉</b></span>
            <span>12351 <b>职工维权</b></span>
            <span>12368 <b>法院热线</b></span>
          </div>
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, inject, watch, nextTick, type Ref } from 'vue'
import { NCard, NAlert, NInputNumber, NSelect, NSlider, NSwitch, NButton, NTable, NGrid, NGi, NDivider, NSteps, NStep, NTooltip, NTag, useMessage } from 'naive-ui'
import { useMainStore } from '../../stores/main'
import SourceTag from '../SourceTag.vue'
import FoldCard from '../FoldCard.vue'
import RealityList from '../RealityList.vue'
import { realityFactsBy } from '../../utils/reality'
import { CompensationService } from '../../application/compensation/CompensationService'
import { provinceOf } from '../../data/provinces'
import type { CompensationResult } from '../../types'

const message = useMessage()
const store = useMainStore()
// 由 RightsView 提供的内部 tab 切换（补偿计算 → 指南 / 文书）
const rightsTab = inject<Ref<string>>('rightsTab')
function goTab(t: string) { if (rightsTab) rightsTab.value = t }

const currentScene = ref('wage')

/** 当前城市所属省份：工伤依据文字与法条引用都按省切换 */
const province = computed(() => provinceOf(store.rule?.city ?? store.work.city) ?? '')
/** 场景卡的依据文字：工伤项必须按省份切换，否则北京用户看到「广东省条例第34条」 */
const scenarios = computed(() => [
  { id: 'wage', name: '欠薪/克扣报酬', icon: '1', legalBasis: '《劳动合同法》第30、38、85条' },
  {
    id: 'injury',
    name: '职业伤害/工伤',
    icon: '2',
    legalBasis: province.value === '广东'
      ? '《工伤保险条例》+广东省条例第34条'
      : '《工伤保险条例》（地方补助金月数按本省办法）',
  },
  { id: 'dismiss', name: '违法解约', icon: '3', legalBasis: '《劳动合同法》第47、87条' },
  { id: 'algorithm', name: '平台算法/处罚争议', icon: '4', legalBasis: '《个保法》第24条+人社部发〔2021〕56号' },
  { id: 'overwork', name: '超时加班费', icon: '5', legalBasis: '《劳动法》第41、44条' },
])

const activeScene = computed(() => scenarios.value.find(s => s.id === currentScene.value)!)

const DEFAULT_FORM = {
  wage: { months: 3, monthly: 8000, percent: 50, tenureMonths: 6, hasContract: false, forcedQuit: false },
  injury: { level: 0, medical: 5000, leaveMonths: 3, income: 8000, hasInsurance: true, mealPerDay: 0, nursingPerDay: 0 },
  dismiss: { years: 2, monthly: 8000, type: 'wrongful', pregnancyMonths: 0 },
  algo: { type: 'unfair_dispatch', loss: 2000, duration: 3, hasLaborRelation: false },
  overwork: { hourlyBase: 30, weekdayHours: 40, weekendHours: 16, holidayHours: 0, months: 3 },
}

const form = reactive(JSON.parse(JSON.stringify(DEFAULT_FORM)))

type CalcResult = CompensationResult

const result = ref<CalcResult | null>(null)

/** 维权现实核查：把本情景的「条件项」金额抽出来，与硬事实一并展示，先压低预期再谈金额 */
const rightsFacts = realityFactsBy([
  'relation-gate', 'conditional-gap', 'evidence-hold',
  'limitation-clock', 'time-cost', 'enforcement', 'account-risk',
])
const conditionalSummary = computed(() => {
  if (!result.value) return null
  const items = result.value.items.filter(i => i.kind === 'conditional' && i.amount > 0 && (i.period ?? 'one-time') === 'one-time')
  if (!items.length) return null
  return { count: items.length, total: items.reduce((s, i) => s + i.amount, 0) }
})
/** 按月给付项（1–4 级伤残津贴）：单独展示，不混入一次性合计 */
const monthlyItems = computed(() => result.value?.items.filter(i => i.period === 'monthly' && i.amount > 0) ?? [])
const monthlyTotal = computed(() => monthlyItems.value.reduce((s, i) => s + i.amount, 0))

/** 计算逻辑单一事实源在 application 层服务（可单测）；组件只负责表单与展示。
 *  此前本组件内联副本与提取件并行且已开始漂移（1–4 级伤残待遇两处同时缺失） */
const compensationService = new CompensationService()

/** 养老基数上下限即全省全口径社平的60%/300%，表单区展示该区间、服务用它封顶保底。
 *  用户填入「本省法定参数」后以用户值为准（与主测算页同源） */
/** 生效的非全日制最低小时工资：用户填的本省值优先（省级标准差异大） */
const effectiveMinHourly = computed(() =>
  store.personal.statutoryOverrides?.minWageHourly
  ?? store.rule?.minimumWage.nonFullTimeHourly
  ?? 0,
)

const pensionFloor = computed(() => effectiveFloor.value)
const pensionCeil = computed(() => effectiveCeil.value)

/** 生效的养老基数上下限：用户填的本省法定参数优先，否则用规则文件值 */
const effectiveFloor = computed(() =>
  store.personal.statutoryOverrides?.baseMin ?? store.rule?.benefit.pension.baseMin ?? 0)
const effectiveCeil = computed(() =>
  store.personal.statutoryOverrides?.baseMax ?? store.rule?.benefit.pension.baseMax ?? Infinity)

function toServiceInput() {
  const rule = store.rule
  if (!rule) return null
  // 必须与主测算同源：用户在「本省法定参数」里填了真实基数后，
  // 补偿侧若仍用占位 4500/22500 封顶保底，2N 与工伤补助金会与测算页口径打架，
  // 并经由文书生成器写进仲裁请求金额
  return {
    scene: currentScene.value as 'wage' | 'injury' | 'dismiss' | 'algorithm' | 'overwork',
    form,
    rule: {
      benefit: { pension: { baseMin: effectiveFloor.value, baseMax: effectiveCeil.value } },
      minimumWage: { nonFullTimeHourly: effectiveMinHourly.value },
      // 省级工伤口径判断用：非广东城市不给广东的医疗/就业补助金月数
      city: rule.city,
    },
  }
}

/**
 * 只有用户实际改动过任一输入项，才把结果交给文书生成器。
 * 首屏的 DEFAULT_FORM 是预填示例而非用户主张的依据，
 * 若在 setup 里就写入 store，文书页会把未经核对的示例金额当作"测算结果"填进仲裁请求。
 */
const userTouched = ref(false)

/** 切场景：新场景的输入仍是示例值，确认状态必须跟着复位，
 *  否则新场景的默认金额会被当作"用户已确认"送进文书 */
function selectScene(id: string) {
  if (currentScene.value === id) return
  currentScene.value = id
  userTouched.value = false
  calc()
}

/** 结果是否只是示例（未确认）：UI 必须与"用户已确认"区分开 */
const isExample = computed(() => !userTouched.value && !!result.value)

function calc() {
  const input = toServiceInput()
  if (!input) { result.value = null; return }
  const r = compensationService.calculate(input)
  result.value = r.ok ? r.value : null
  // 文书生成器读取同一份结果，避免两处各自换算导致金额不一致
  store.setCompensation(userTouched.value ? result.value : null)
}

// 规则是异步加载的：到达/切城（基数上下限变化）后按当前表单重算，
// 否则组件挂载早于规则就绪时首屏永远停在空态
watch(() => store.rule, (r) => { if (r) calc() })

// 用户改动任一输入项即视为已确认，之后的结果才可进入文书。
// 程序性重置（resetForm）造成的变更不算用户确认：deep watch 在 Object.assign
// 之后的下一个 tick 才触发，会把重置后的示例值重新标成已确认、再写回 store。
// 用 resetting 守卫跨过这一段时序（nextTick 后再解除）。
let resetting = false
watch(form, () => {
  if (resetting) return
  userTouched.value = true
  calc()
}, { deep: true, flush: 'sync' })

async function resetForm() {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_FORM))[currentScene.value as keyof typeof DEFAULT_FORM]
  resetting = true
  Object.assign(form[currentScene.value as keyof typeof form], defaults)
  // 重置回示例值后同样不能算作"用户已确认"
  userTouched.value = false
  calc()
  message.success('已重置当前场景参数')
  await nextTick()
  resetting = false
}

// 首屏渲染（不写入 store）
calc()
</script>

<style scoped>
.scenario-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.scenario-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--color-border-primary);
  border-radius: 6px;
  padding: 12px 8px;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;
  background: var(--color-bg-primary);
  color: inherit;
  font: inherit;
}
.scenario-card:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}
.scenario-card:hover { border-color: var(--color-text-brand); }
.scenario-card.active { border-color: var(--color-text-brand); background: rgba(13,148,136,0.04); }
.sc-icon { width: 28px; height: 28px; margin: 0 auto 6px; border-radius: 50%; background: var(--color-bg-tertiary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: var(--color-text-secondary); }
.scenario-card.active .sc-icon { background: var(--color-primary-500); color: var(--color-text-inverse); }
.sc-name { font-size: 12px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 2px; }
.sc-basis { font-size: 10px; color: var(--color-text-tertiary); }

.form-section { display: flex; flex-direction: column; gap: 10px; }
.form-item label { font-size: 12px; color: var(--color-text-secondary); font-weight: 500; display: block; margin-bottom: 3px; }
.form-note { font-size: 11px; color: var(--color-text-tertiary); margin-top: 4px; margin-bottom: 0; line-height: 1.5; }

.result-empty { text-align: center; color: var(--color-text-tertiary); padding: 40px 0; font-size: 13px; }

.result-total {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 16px; background: var(--color-primary-500); color: var(--color-text-inverse);
  border-radius: 6px; margin-bottom: 12px;
}
.result-total span { font-size: 12px; opacity: 0.85; }
.result-total strong { font-size: 20px; }
.result-monthly {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 16px; background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-primary); border-radius: 6px; margin-bottom: 12px;
}
.result-monthly span { font-size: 11px; color: var(--color-text-secondary); line-height: 1.4; max-width: 60%; }
.result-monthly strong { font-size: 15px; color: var(--color-text-primary); }
.result-conditional {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 16px; background: var(--color-warning-50);
  border: 1px solid var(--color-warning-200); border-radius: 6px; margin-bottom: 12px;
}
.result-conditional span { font-size: 11px; color: var(--color-text-warning); line-height: 1.4; max-width: 60%; }
.result-conditional strong { font-size: 15px; color: var(--color-text-warning); }
.kind-tag { margin-right: 4px; }

.info-icon { color: var(--color-text-brand); cursor: help; font-size: 11px; margin-left: 2px; }
.text-muted { color: var(--color-border-secondary); }

.legal-refs { display: flex; flex-direction: column; gap: 3px; }
.lr-title { font-size: 11px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.lr-item { font-size: 11px; color: var(--color-text-secondary); padding: 3px 0; border-left: 2px solid var(--color-border-primary); padding-left: 8px; }

.action-buttons { display: flex; gap: 8px; }

.hotline-bar {
  display: flex; gap: 14px; padding-top: 8px;
  border-top: 1px solid var(--color-bg-tertiary); margin-top: 6px;
  font-size: 11px; color: var(--color-text-secondary); flex-wrap: wrap;
}
.hotline-bar span{white-space:nowrap;}
.hotline-bar b { color: var(--color-text-primary); }
</style>
