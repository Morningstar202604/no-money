<template>
  <div class="param-sidebar">
    <!-- City indicator -->
    <div class="ps-head">
      <span class="ps-city">{{ store.rule?.cityName || '—' }}</span>
      <span class="ps-hint">调整参数实时计算</span>
    </div>

    <!-- City -->
    <div class="ps-group">
      <div class="ps-group-title">所在城市</div>
      <n-select
        :value="store.work.city"
        :options="cityOptions"
        size="small"
        :disabled="store.loading"
        @update:value="(v: string) => store.setCity(v)"
      />
      <!-- 触控目标：tiny 只有 22px 高，手机上难点，这里显式抬到 32px -->
      <n-button size="tiny" quaternary block style="margin-top:4px; min-height: 32px" @click="showMap = true">
        在地图上选城市（全国）
      </n-button>
    </div>

    <n-modal v-model:show="showMap" preset="card" title="选择城市 — 全国地图" :style="{ width: 'min(760px, 94vw)' }">
      <ChinaMapPicker :current="store.work.city" @select="onMapPick" />
      <template #footer>
        <div class="map-foot">
          已收录 {{ cityCount }} 座城市（覆盖全部 31 个省级行政区）；标「待核实」的省市请用下方
          「本省法定参数」填入当地人社厅公布的真实值。
        </div>
      </template>
    </n-modal>

    <!-- 本省法定参数校准：全国 31 省级区划的社保基数由各省单独公布，
         未核实的省份必须允许用户填入本省官方值，否则只能用占位量级。 -->
    <FoldCard
      v-if="ruleUnverified"
      class="ps-fold"
      dense
      :title="`本省法定参数（${store.rule?.cityName ?? ''}尚未核实）`"
      :summary="statutoryCount > 0 ? `已填 ${statutoryCount} 项` : '当前为全国量级占位值'"
      default-open
    >
      <div class="ps-group">
        <n-alert type="warning" :show-icon="true" style="margin-bottom: 8px">
          <div><b>本省社保基数与最低工资未回溯官方原文</b></div>
          <div style="margin-top:4px;font-size:12px">
            当前用的是全国量级参考值（基数 {{ store.rule?.benefit.pension.baseMin }}–{{ store.rule?.benefit.pension.baseMax }}、
            最低工资 {{ store.rule?.minimumWage.monthly }} 元）。请查你所在省人社厅公布的当年值填入，
            填入后测算与评级才会锚定本省口径。
          </div>
        </n-alert>

        <div class="ps-item">
          <div class="ps-label">缴费基数下限（元） <b>{{ effectiveBaseMin }}</b></div>
          <n-input-number
            :value="store.personal.statutoryOverrides?.baseMin"
            :min="0" :max="100000" :step="100" size="small" style="width:100%"
            :placeholder="`占位值 ${store.rule?.benefit.pension.baseMin ?? '—'}`"
            @update:value="(v: number | null) => setStatutory('baseMin', v)"
          />
        </div>
        <div class="ps-item">
          <div class="ps-label">缴费基数上限（元） <b>{{ effectiveBaseMax }}</b></div>
          <n-input-number
            :value="store.personal.statutoryOverrides?.baseMax"
            :min="0" :max="300000" :step="100" size="small" style="width:100%"
            :placeholder="`占位值 ${store.rule?.benefit.pension.baseMax ?? '—'}`"
            @update:value="(v: number | null) => setStatutory('baseMax', v)"
          />
          <div class="ps-note">上限应约为下限的 5 倍（法定 60%–300% 区间）；填错会被自动忽略</div>
        </div>
        <div class="ps-item">
          <div class="ps-label">月最低工资（元） <b>{{ effectiveMinWage }}</b></div>
          <n-input-number
            :value="store.personal.statutoryOverrides?.minWageMonthly"
            :min="0" :max="20000" :step="10" size="small" style="width:100%"
            :placeholder="`占位值 ${store.rule?.minimumWage.monthly ?? '—'}`"
            @update:value="(v: number | null) => setStatutory('minWageMonthly', v)"
          />
          <div class="ps-note">用于权益评分评级锚点与「低于最低工资」提示</div>
        </div>
        <n-button v-if="statutoryCount > 0" size="tiny" quaternary block @click="clearStatutory">
          清除本省参数，回到占位值
        </n-button>
      </div>
    </FoldCard>

    <!-- Work params -->
    <FoldCard
      class="ps-fold"
      dense
      default-open
      title="工作参数"
      :summary="`${store.work.dailyHours}h/天 · ${store.work.dailyOrders}单 · ${store.work.workDaysMonth}天`"
    >
      <div class="ps-group">
        <!-- 滑块区间覆盖常见场景（兼职/新手 2h、5单、15天），但不等于 domain 的
             全部合法区间（domain 允许 24h/200单/50km）：UI 是常见值域，存储与导入
             仍接受更宽范围，避免恢复老数据时被夹窄 -->
        <div class="ps-item">
          <div class="ps-label">日均工时 <b>{{ store.work.dailyHours }}h</b></div>
          <n-slider v-model:value="store.work.dailyHours" :min="1" :max="14" :step="1" :tooltip-formatter="(v: number) => v + ' 小时'" />
        </div>

        <div class="ps-item">
          <div class="ps-label">日均接单 <b>{{ store.work.dailyOrders }}单</b></div>
          <n-slider v-model:value="store.work.dailyOrders" :min="0" :max="60" :step="1" :tooltip-formatter="(v: number) => v + ' 单'" />
        </div>

        <div class="ps-item">
          <div class="ps-label">平均距离 <b>{{ store.work.avgDistance }}km</b></div>
          <n-slider v-model:value="store.work.avgDistance" :min="1" :max="6" :step="0.5" :tooltip-formatter="(v: number) => v + ' km'" />
        </div>

        <div class="ps-item">
          <div class="ps-label">月工作天 <b>{{ store.work.workDaysMonth }}天</b></div>
          <n-slider v-model:value="store.work.workDaysMonth" :min="0" :max="31" :step="1" :tooltip-formatter="(v: number) => v + ' 天'" />
        </div>

        <div class="ps-item">
          <div class="ps-label">月雨天 <b>{{ store.work.rainDaysMonth }}天</b></div>
          <n-slider v-model:value="store.work.rainDaysMonth" :min="0" :max="15" :step="1" :tooltip-formatter="(v: number) => v + ' 天'" />
        </div>

        <div class="ps-item">
          <div class="ps-label">月节假日 <b>{{ store.work.holidayDaysMonth }}天</b></div>
          <n-slider v-model:value="store.work.holidayDaysMonth" :min="0" :max="10" :step="1" :tooltip-formatter="(v: number) => v + ' 天'" />
        </div>
      </div>
    </FoldCard>

    <!-- 产能模型：工时与单量的物理约束，用户可用自己的实测数据校准 -->
    <FoldCard
      class="ps-fold"
      dense
      title="配送产能（工时与单量的换算）"
      :summary="`单均 ${capacityMinutes.toFixed(1)} 分钟 · 产能 ${capacityMax.toFixed(0)} 单/日`"
    >
      <div class="ps-group">
        <div class="ps-note" style="margin-bottom:6px">
          「多跑2小时」「多接5单」不能各改一个数字——多跑时间必然多接单，多接单必然要多花时间。
          这三个参数决定换算关系，用你自己的实际数据校准后，方案对比才可信。
        </div>

        <div class="ps-item">
          <div class="ps-label">单均固定耗时（分钟） <b>{{ store.capacityModel.fixedMinutesPerOrder }}</b></div>
          <n-slider v-model:value="store.capacityModel.fixedMinutesPerOrder" :min="1" :max="30" :step="1" />
          <div class="ps-note">接单、到店、等餐、上楼、交付的固定开销</div>
        </div>

        <div class="ps-item">
          <div class="ps-label">平均骑行速度 <b>{{ store.capacityModel.avgSpeedKmh }} km/h</b></div>
          <n-slider v-model:value="store.capacityModel.avgSpeedKmh" :min="5" :max="40" :step="1" />
        </div>

        <div class="ps-item">
          <div class="ps-label">日休息与等单 <b>{{ store.capacityModel.breakMinutesPerDay }} 分钟</b></div>
          <n-slider v-model:value="store.capacityModel.breakMinutesPerDay" :min="0" :max="300" :step="15" />
          <div class="ps-note">吃饭、休息、无单可接的空档；不计入配送时间</div>
        </div>

        <div class="ps-note">
          当前：单均 {{ capacityMinutes.toFixed(1) }} 分钟，产能上限 {{ capacityMax.toFixed(0) }} 单/日；
          你的设定 {{ store.work.dailyOrders }} 单{{ capacityOverloaded ? '已超出产能（现实需更长工时或更快速度）' : '在产能范围内' }}。
        </div>
      </div>
    </FoldCard>

    <!-- 计价覆盖：本城规则里的平台计价是占位值，用户按自己 APP 流水覆盖后才算真实测算 -->
    <FoldCard
      class="ps-fold"
      dense
      :title="`我的计价${overrideCount > 0 ? `（已填 ${overrideCount} 项）` : ''}`"
      :summary="overrideCount > 0 ? '按你的流水测算' : '默认为占位值'"
    >
      <div class="ps-group">
        <div class="ps-note" style="margin-bottom:6px">
          本城平台单价与倍率没有跨平台权威来源（规则文件里标为「未核实」）。填你在 APP 里看到的真实值，
          测算才会变成你的数据；留空的项继续按占位值算，并在页顶标为「假设测算」。
        </div>

        <div class="ps-item">
          <div class="ps-label">每单基础配送费 <b>{{ overrideValue('basePricePerOrder', store.rule?.income.basePricePerOrder) }} 元</b></div>
          <n-input-number
            :value="store.personal.incomeOverrides?.basePricePerOrder"
            :min="0" :max="50" :step="0.1" size="small" style="width:100%"
            :placeholder="`占位值 ¥${store.rule?.income.basePricePerOrder ?? '—'}`"
            @update:value="(v: number | null) => setOverride('basePricePerOrder', v)"
          />
        </div>

        <div class="ps-item">
          <div class="ps-label">距离费（元/公里） <b>{{ overrideValue('distanceRate', store.rule?.income.distanceRate) }}</b></div>
          <n-input-number
            :value="store.personal.incomeOverrides?.distanceRate"
            :min="0" :max="20" :step="0.1" size="small" style="width:100%"
            :placeholder="`占位值 ¥${store.rule?.income.distanceRate ?? '—'}`"
            @update:value="(v: number | null) => setOverride('distanceRate', v)"
          />
        </div>

        <div class="ps-item">
          <div class="ps-label">峰时倍率 <b>{{ overrideValue('peakMultiplier', store.rule?.income.timeSubsidy.multiplier) }}×</b></div>
          <n-input-number
            :value="store.personal.incomeOverrides?.peakMultiplier"
            :min="1" :max="3" :step="0.05" size="small" style="width:100%"
            :placeholder="`占位值 ${store.rule?.income.timeSubsidy.multiplier ?? '—'}×`"
            @update:value="(v: number | null) => setOverride('peakMultiplier', v)"
          />
          <div class="ps-note">APP 里「高峰时段每单加价」换算成的倍数（如基础 5 元、峰时 6.25 元 = 1.25×）</div>
        </div>

        <div class="ps-item">
          <div class="ps-label">雨天倍率 <b>{{ overrideValue('rainSurcharge', store.rule?.income.rainSurcharge) }}×</b></div>
          <n-input-number
            :value="store.personal.incomeOverrides?.rainSurcharge"
            :min="1" :max="3" :step="0.05" size="small" style="width:100%"
            :placeholder="`占位值 ${store.rule?.income.rainSurcharge ?? '—'}×`"
            @update:value="(v: number | null) => setOverride('rainSurcharge', v)"
          />
        </div>

        <div class="ps-item">
          <div class="ps-label">节假日倍率 <b>{{ overrideValue('holidayMultiplier', store.rule?.income.holidayMultiplier) }}×</b></div>
          <n-input-number
            :value="store.personal.incomeOverrides?.holidayMultiplier"
            :min="1" :max="3" :step="0.05" size="small" style="width:100%"
            :placeholder="`占位值 ${store.rule?.income.holidayMultiplier ?? '—'}×`"
            @update:value="(v: number | null) => setOverride('holidayMultiplier', v)"
          />
        </div>

        <div class="ps-item">
          <div class="ps-label">单均重量（公斤，选填） <b>{{ store.personal.incomeOverrides?.avgWeightKg ?? '—' }}</b></div>
          <n-input-number
            :value="store.personal.incomeOverrides?.avgWeightKg"
            :min="0" :max="100" :step="0.5" size="small" style="width:100%"
            placeholder="超过 5kg 的部分按超重加价计"
            @update:value="(v: number | null) => setOverride('avgWeightKg', v)"
          />
          <div class="ps-note">对应规则里的超重件加价（阈值 {{ store.rule?.income.weightSurcharge.threshold }}kg、{{ store.rule?.income.weightSurcharge.rate }} 元/kg）；不填则不计这块收入</div>
        </div>

        <n-button v-if="overrideCount > 0" size="tiny" quaternary block @click="clearOverrides">清除我的计价，回到占位值</n-button>
      </div>
    </FoldCard>

    <!-- Costs -->
    <FoldCard
      class="ps-fold"
      dense
      title="车辆与成本"
      :summary="`月支出 ¥${costTotal.toLocaleString()}`"
    >
      <div class="ps-group">
        <div class="ps-item">
          <div class="ps-label">车辆类型</div>
          <n-radio-group v-model:value="store.costs.vehicleType" size="small">
            <n-radio-button value="electric">电动</n-radio-button>
            <n-radio-button value="fuel">燃油</n-radio-button>
            <n-radio-button value="mixed">混合</n-radio-button>
          </n-radio-group>
        </div>

        <div v-if="store.costs.vehicleType !== 'electric'" class="ps-item">
          <div class="ps-label">月油费 <b>¥{{ store.costs.fuelCostMonth }}</b></div>
          <n-slider v-model:value="store.costs.fuelCostMonth" :min="0" :max="8000" :step="100" />
        </div>

        <div v-if="store.costs.vehicleType !== 'fuel'" class="ps-item">
          <div class="ps-label">月充电费 <b>¥{{ store.costs.electricityCostMonth }}</b></div>
          <n-slider v-model:value="store.costs.electricityCostMonth" :min="0" :max="3000" :step="50" />
        </div>

        <div class="ps-item">
          <div class="ps-label">维护费/租车费 <b>¥{{ store.costs.maintenanceMonth }}</b></div>
          <n-slider v-model:value="store.costs.maintenanceMonth" :min="0" :max="6000" :step="50" />
          <div class="ps-note">租车跑单的话把月租金也记在这里（上限已放宽到 ¥6000）</div>
        </div>

        <div class="ps-item">
          <div class="ps-label">餐饮费 <b>¥{{ store.costs.foodCostMonth }}</b></div>
          <n-slider v-model:value="store.costs.foodCostMonth" :min="0" :max="5000" :step="100" />
        </div>

        <div class="ps-item">
          <div class="ps-label">商业保险 <b>¥{{ store.costs.insuranceMonth }}</b></div>
          <n-slider v-model:value="store.costs.insuranceMonth" :min="0" :max="3000" :step="50" />
        </div>

        <div class="ps-item">
          <div class="ps-label">通讯费 <b>¥{{ store.costs.phoneCostMonth }}</b></div>
          <n-slider v-model:value="store.costs.phoneCostMonth" :min="0" :max="1000" :step="25" />
        </div>

        <div class="ps-item">
          <div class="ps-label">交通罚款 <b>¥{{ store.costs.trafficFineMonth }}</b></div>
          <n-slider v-model:value="store.costs.trafficFineMonth" :min="0" :max="2000" :step="25" />
        </div>

        <div class="ps-item">
          <div class="ps-label">车辆折旧 <b>¥{{ store.costs.vehicleDepreciationMonth }}</b></div>
          <n-slider v-model:value="store.costs.vehicleDepreciationMonth" :min="0" :max="5000" :step="50" />
        </div>

        <div class="ps-item">
          <div class="ps-label">其他 <b>¥{{ store.costs.otherCostMonth }}</b></div>
          <n-slider v-model:value="store.costs.otherCostMonth" :min="0" :max="5000" :step="50" />
        </div>
      </div>
    </FoldCard>

    <!-- Tax & Insurance -->
    <FoldCard
      class="ps-fold"
      dense
      title="税务与社保"
      :summary="store.personal.hasSocialInsurance ? '已参保' : '未参保'"
    >
      <div class="ps-group">
        <div class="ps-item">
          <div class="ps-label">当前年龄 <b>{{ store.personal.currentAge }}岁</b></div>
          <n-slider v-model:value="store.personal.currentAge" :min="16" :max="80" :step="1" :tooltip-formatter="(v: number) => v + ' 岁'" />
        </div>

        <div class="ps-item">
          <div class="ps-label">预计退休年龄 <b>{{ store.personal.expectedRetireAge }}岁</b></div>
          <n-slider v-model:value="store.personal.expectedRetireAge" :min="store.personal.currentAge + 1" :max="90" :step="1" :tooltip-formatter="(v: number) => v + ' 岁'" />
        </div>

        <div class="ps-item ps-switch-row">
          <span class="ps-label">已缴社保</span>
          <n-switch v-model:value="store.personal.hasSocialInsurance" size="small" />
        </div>

        <div v-if="medicalTiers.length > 0" class="ps-item">
          <div class="ps-label">医保档次 <SourceTag source-key="medical" /></div>
          <n-select
            :value="store.personal.medicalTierId || defaultTierId"
            :options="medicalTierOptions"
            size="small"
            @update:value="(v: string) => store.personal.medicalTierId = v === defaultTierId ? undefined : v"
          />
          <div class="ps-note">{{ activeTierNote }}</div>
        </div>

        <template v-if="store.personal.hasSocialInsurance">
          <div class="ps-item">
            <div class="ps-label">养老缴费基数 <SourceTag source-key="pension" /> <b>¥{{ store.personal.pensionBase ?? autoPensionBase }}</b></div>
            <n-slider
              :value="store.personal.pensionBase ?? autoPensionBase"
              :min="pensionBaseMin"
              :max="pensionBaseMax"
              :step="100"
              @update:value="(v: number) => store.personal.pensionBase = v === autoPensionBase ? undefined : v"
            />
            <div class="ps-note">
              规则原文：基数在上下限范围内自选（粤人社规〔2026〕14号第六条）。留空=按申报收入 ¥{{ Math.round(store.scenarios[0]?.income.grossIncome ?? 0) }} 计。
              <b>选低基数当期省得多，但退休时的平均缴费指数随之降低，基础养老金会减少。</b>
            </div>
          </div>

          <div class="ps-item">
            <div class="ps-label">医保缴费基数 <SourceTag source-key="medical" /> <b>¥{{ store.personal.medicalBase ?? autoMedicalBase }}</b></div>
            <n-slider
              :value="store.personal.medicalBase ?? autoMedicalBase"
              :min="medicalBaseMin"
              :max="medicalBaseMax"
              :step="100"
              @update:value="(v: number) => store.personal.medicalBase = v === autoMedicalBase ? undefined : v"
            />
            <div class="ps-note">同上，医保基数也在上下限内自选。留空=按申报收入计。</div>
          </div>
        </template>

        <div class="ps-item">
          <div class="ps-label">专项附加扣除/月 <b>¥{{ store.personal.specialDeductionMonth }}</b></div>
          <!-- 上限 10,000：七项专项附加扣除可叠加（子女教育 2,000×2 + 赡养老人 3,000 + 房贷 1,000 已达 8,000），
               此前卡 5,000 会让多孩+赡养家庭无法如实填写 -->
          <n-slider v-model:value="store.personal.specialDeductionMonth" :min="0" :max="10000" :step="500" />
          <div class="ps-note">子女教育 / 房贷 / 租金 / 赡养老人等七项可叠加。税额按年度汇算清缴口径，含 5000 元/月基本减除；若你另有主业已享受该减除，实际税负会更高</div>
        </div>

        <div class="ps-item">
          <div class="ps-label">个人养老金年缴 <b>¥{{ store.personal.personalPensionAnnual ?? 0 }}</b></div>
          <n-input-number
            :value="store.personal.personalPensionAnnual"
            :min="0" :max="12000" :step="1000" size="small" style="width:100%"
            placeholder="0 = 未参加（法定上限 12,000 元/年）"
            @update:value="(v: number | null) => store.personal.personalPensionAnnual = v ?? undefined"
          />
          <div class="ps-note">缴费据实税前扣除，领取时按 3% 单独计税；账户内投资收益暂不征税。详情见「政策百科 → 民生手册 → 保险与税优」</div>
        </div>

        <div class="ps-item">
          <div class="ps-label">税优健康险年缴 <b>¥{{ store.personal.taxHealthInsuranceAnnual ?? 0 }}</b></div>
          <n-input-number
            :value="store.personal.taxHealthInsuranceAnnual"
            :min="0" :max="2400" :step="200" size="small" style="width:100%"
            placeholder="0 = 未购买（法定上限 2,400 元/年）"
            @update:value="(v: number | null) => store.personal.taxHealthInsuranceAnnual = v ?? undefined"
          />
          <div class="ps-note">符合规定的商业健康险保费可在税前扣除，限额 2,400 元/年</div>
        </div>
      </div>
    </FoldCard>

    <div class="ps-foot">
      <!-- 不用 n-tag type="info"：它用 naive-ui 自带配色，深色主题下正文对比度只有 1.34:1。
           这里用设计 token，两套主题都达标。 -->
      <span class="ps-privacy">参数与测算均在本机完成</span>
      <div v-if="store.cityNotice" class="ps-notice">
        <span>{{ store.cityNotice }}</span>
        <button class="ps-notice-x" aria-label="关闭提示" @click="store.cityNotice = null">×</button>
      </div>
      <div v-if="store.persistError" class="ps-persist-error">{{ store.persistError }}</div>
      <div v-if="store.paramsRestored" class="ps-restored">
        <span>已恢复上次未完成的测算参数</span>
        <button class="ps-restored-x" aria-label="关闭提示" @click="store.paramsRestored = false">×</button>
      </div>
      <div v-if="importError" class="ps-persist-error">{{ importError }}</div>
      <!-- 分享：把当前参数编码进 URL，发给同行/家人让对方原样看到自己的情况。
           消息类按钮必须给可感知反馈，"已复制"比静默成功重要 -->
      <n-button size="tiny" quaternary block @click="shareLink">
        {{ shared ? '已复制分享链接 ✓' : '复制分享链接' }}
      </n-button>
      <div class="ps-io">
        <n-button size="tiny" quaternary block @click="exportParams">导出参数</n-button>
        <n-button size="tiny" quaternary block @click="importInput?.click()">导入参数</n-button>
      </div>
      <input ref="importInput" type="file" accept="application/json,.json" hidden @change="onImportFile">
      <n-button size="tiny" quaternary block @click="store.resetParams()">重置为默认参数</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NSlider, NRadioGroup, NRadioButton, NSwitch, NSelect, NButton, NModal, NInputNumber, NAlert, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useMainStore, CITIES } from '../stores/main'
import { calcCosts } from '../domain/income/calculator'
import { adaptCosts } from '../application/adapters/ruleAdapters'
import { calcCapacity } from '../domain/income/capacity'
import { downloadTextFile, copyText } from '../utils/download'
import SourceTag from './SourceTag.vue'
import FoldCard from './FoldCard.vue'
import ChinaMapPicker from './ChinaMapPicker.vue'

const store = useMainStore()

/** 参数导出/导入：快照与持久化同构，文件不含任何敏感数据 */
const importInput = ref<HTMLInputElement>()
const importError = ref<string | null>(null)

/** 生成带参数的分享链接并复制。失败时用消息告知而不是静默。 */
const message = useMessage()
const shared = ref(false)
let sharedTimer: ReturnType<typeof setTimeout> | undefined
async function shareLink() {
  try {
    const { encodeShare } = await import('../utils/share')
    const code = encodeShare({
      work: store.work, costs: store.costs, personal: store.personal,
      capacityModel: store.capacityModel, volatilityCv: store.volatilityCv,
    })
    const url = `${location.origin}${location.pathname}?s=${code}`
    // 走统一复制工具：Clipboard API 被拒（http 局域网/老内核/无权限）时自动回退 execCommand
    const ok = await copyText(url)
    if (!ok) throw new Error('execCommand 复制失败')
    shared.value = true
    clearTimeout(sharedTimer)
    sharedTimer = setTimeout(() => (shared.value = false), 2500)
    import.meta.env.DEV && console.info('[share] url length:', url.length)
  } catch (e) {
    message.error('无法复制链接：' + (e instanceof Error ? e.message : '剪贴板不可用'))
  }
}

function exportParams() {
  const ok = downloadTextFile({
    filename: `no-money-params-${store.work.city}.json`,
    content: store.exportParams(),
    mimeType: 'application/json',
  })
  if (!ok) importError.value = '当前浏览器不支持文件下载'
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    importError.value = '所选文件不是合法 JSON'
    return
  }
  importError.value = store.importParams(parsed)
}
/** 计价覆盖（用户按自己 APP 流水填的实测值） */
type OverrideKey = 'basePricePerOrder' | 'distanceRate' | 'peakMultiplier' | 'rainSurcharge' | 'holidayMultiplier' | 'avgWeightKg'

const overrideCount = computed(() => {
  const o = store.personal.incomeOverrides
  if (!o) return 0
  return Object.values(o).filter(v => typeof v === 'number' && Number.isFinite(v)).length
})

/** 展示值：有覆盖显示覆盖值，否则显示本城占位值 */
function overrideValue(key: OverrideKey, fallback?: number): string {
  const v = store.personal.incomeOverrides?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : (fallback ?? '—').toString()
}

function setOverride(key: OverrideKey, v: number | null) {
  const next = { ...(store.personal.incomeOverrides ?? {}) }
  if (v === null || !Number.isFinite(v)) delete next[key]
  else next[key] = v
  store.personal.incomeOverrides = Object.keys(next).length > 0 ? next : undefined
}

function clearOverrides() {
  store.personal.incomeOverrides = undefined
}

/** 产能摘要：用当前三个参数算出单均耗时与日产能，供卡片标题与提示使用 */
const capacityEval = computed(() => calcCapacity(
  store.work.dailyHours,
  store.work.dailyOrders,
  store.work.avgDistance,
  store.capacityModel,
))
const capacityMinutes = computed(() => capacityEval.value.minutesPerOrder)
const capacityMax = computed(() => capacityEval.value.maxOrdersPerDay)
const capacityOverloaded = computed(() => capacityEval.value.overloaded)

/** 当前城市规则是否未核实（决定是否显示「本省法定参数」校准卡） */
const ruleUnverified = computed(() =>
  store.rule?.sources?.pension?.confidence === 'unverified'
  || store.rule?.sources?.minimumWage?.confidence === 'unverified',
)

const statutoryCount = computed(() => {
  const o = store.personal.statutoryOverrides
  if (!o) return 0
  return Object.values(o).filter(v => typeof v === 'number' && Number.isFinite(v)).length
})

/** 生效值：用户覆盖优先，否则规则值 */
const effectiveBaseMin = computed(() => store.personal.statutoryOverrides?.baseMin ?? store.rule?.benefit.pension.baseMin ?? '—')
const effectiveBaseMax = computed(() => store.personal.statutoryOverrides?.baseMax ?? store.rule?.benefit.pension.baseMax ?? '—')
const effectiveMinWage = computed(() => store.personal.statutoryOverrides?.minWageMonthly ?? store.rule?.minimumWage.monthly ?? '—')

type StatutoryKey = 'baseMin' | 'baseMax' | 'minWageMonthly' | 'minWageHourly'
function setStatutory(key: StatutoryKey, v: number | null) {
  const next = { ...(store.personal.statutoryOverrides ?? {}) }
  if (v === null || !Number.isFinite(v)) delete next[key]
  else next[key] = v
  store.personal.statutoryOverrides = Object.keys(next).length > 0 ? next : undefined
}
function clearStatutory() {
  store.personal.statutoryOverrides = undefined
}

const cityOptions = CITIES
const showMap = ref(false)
const cityCount = CITIES.length

function onMapPick(city: string) {
  showMap.value = false
  void store.setCity(city)
}

const costTotal = computed(() => {
  // 直接复用 domain 的成本函数：车型过滤（电动车不计油费）与夹取规则
  // 只在那一处定义，侧栏不再手写第二份求和，避免与测算结果漂移
  return Number(calcCosts(adaptCosts(store.costs)).total) / 100
})

/** 东莞等地医保分档收费，无单一法定费率，必须让用户按实际参保档次选 */
const medicalTiers = computed(() => store.rule?.benefit.medicalTiers ?? [])
/** 未选择时按规则文件的默认档（benefit.medical.rate）测算 */
const defaultTierId = computed(() => medicalTiers.value.find(t => t.rate === store.rule?.benefit.medical.rate)?.id ?? '')
const medicalTierOptions = computed(() =>
  medicalTiers.value.map(t => ({
    value: t.id,
    label: `${t.name}（${(t.rate * 100).toFixed(2)}%）`,
  }))
)
const activeTierNote = computed(() =>
  medicalTiers.value.find(t => t.id === (store.personal.medicalTierId || defaultTierId.value))?.note ?? ''
)

/**
 * 缴费基数可在法定上下限内自选（粤人社规〔2026〕14号第六条）。
 * 未自选时展示的 autoPensionBase / autoMedicalBase 是引擎"按申报收入夹取"的结果，
 * 滑块拖到该值即视为回到默认，避免 personal 里存下一堆与自动值等价的冗余数字。
 */
const pensionBaseMin = computed(() => store.rule?.benefit.pension.baseMin ?? 0)
const pensionBaseMax = computed(() => store.rule?.benefit.pension.baseMax ?? 10000)
const medicalBaseMin = computed(() => store.rule?.benefit.medical.baseMin ?? 0)
const medicalBaseMax = computed(() => store.rule?.benefit.medical.baseMax ?? 10000)

function autoBase(min: number, max: number): number {
  const gross = store.scenarios[0]?.income.grossIncome ?? 0
  return Math.round(Math.min(Math.max(gross, min), max))
}
const autoPensionBase = computed(() => autoBase(pensionBaseMin.value, pensionBaseMax.value))
const autoMedicalBase = computed(() => autoBase(medicalBaseMin.value, medicalBaseMax.value))
</script>

<style scoped>
.param-sidebar {
  padding: 10px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ps-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 2px 0;
}
.ps-city {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.ps-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

/* 折叠面板内部的参数组不再带自身外框，由 FoldCard 统一承载 */
.ps-fold + .ps-fold {
  margin-top: 0;
}

.ps-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ps-group-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: 6px 2px 2px;
}

.ps-item {
  padding: 2px 0;
}
.ps-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.ps-label b {
  margin-left: auto;
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 12px;
}

.ps-switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}
.ps-switch-row .ps-label {
  margin-bottom: 0;
}

.ps-note {
  font-size: 10px;
  color: var(--color-text-tertiary);
  margin-top: 2px;
  padding-left: 2px;
}

.ps-privacy {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-primary-50);
  color: var(--color-text-primary);
  font-size: var(--font-size-xs);
  border: 1px solid var(--surface-border);
}

.ps-foot {
  margin-top: 10px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ps-restored-x {
  position: absolute;
  top: 2px;
  right: 4px;
  border: none;
  background: transparent;
  color: var(--color-text-brand);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.ps-restored {
  position: relative;
  font-size: 10px;
  text-align: left;
  color: var(--color-text-brand);
  background: rgba(13,148,136,0.07);
  border-radius: 3px;
  /* padding-right 必须在 padding 简写之后声明，否则被简写覆盖、× 压住文字 */
  padding: 3px 6px;
  padding-right: 20px;
}

.ps-notice {
  position: relative;
  font-size: 10px;
  line-height: 1.6;
  color: var(--color-text-warning);
  background: var(--color-warning-50);
  border: 1px solid var(--color-warning-200);
  border-radius: 3px;
  padding: 4px 18px 4px 6px;
}
.ps-notice-x {
  position: absolute;
  top: 2px;
  right: 4px;
  border: none;
  background: transparent;
  color: var(--color-text-warning);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.ps-io { display: flex; gap: 4px; }
.ps-io .n-button { flex: 1; }
.ps-persist-error {
  font-size: 10px;
  line-height: 1.6;
  color: var(--color-danger-600);
  background: var(--color-danger-50);
  border: 1px solid var(--color-danger-200);
  border-radius: 3px;
  padding: 4px 6px;
}

.map-foot { font-size: 11px; color: var(--color-text-tertiary); }

/* 触控目标最小尺寸（WCAG 2.2 AA 要求 24×24 CSS px）。
   size="tiny" 的 n-button 只有 22px 高，手机上点起来很吃力，
   实测「导出/导入/重置/选城市」四个按钮全部低于阈值。 */
.ps-io :deep(.n-button),
.ps-foot :deep(.n-button) {
  min-height: 28px;
}

@media (max-width: 768px) {
  .ps-io :deep(.n-button),
  .ps-foot :deep(.n-button),
  .ps-io .n-button,
  .ps-foot .n-button {
    min-height: 36px;
  }
}
</style>
