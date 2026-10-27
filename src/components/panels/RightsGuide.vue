<template>
  <div>
    <n-card title="维权行动指南 — 从取证到仲裁" class="card">
      <p class="desc">
        针对灵活就业场景的完整维权实操指南。包含每一步的具体做法、文书模板、取证清单、时效提醒。
      </p>
    </n-card>

    <!-- Quick nav -->
    <div class="quick-nav">
      <a v-for="s in steps" :key="s.id" :class="['qn-item', { active: activeStep === s.id }]" @click="activeStep = s.id">
        <span class="qn-num">{{ s.num }}</span>
        <span class="qn-name">{{ s.name }}</span>
      </a>
    </div>

    <!-- Step Content -->
    <n-grid :x-gap="12" cols="3" responsive="screen" style="margin-top: 12px">
      <n-gi :span="2">
        <!-- Step 1: Evidence -->
        <n-card v-if="activeStep === 'evidence'" class="card" title="第1步 — 固定证据（最关键）">
          <div class="step-body">
            <p class="step-intro">所有维权的前提。没有证据，再有道理也打不赢。<strong>在争议发生第一时间</strong>完成以下取证：</p>

            <div class="checklist-section">
              <h4>劳动关系证明（先证明你跟平台有关系）</h4>
              <div class="checklist">
                <label><input type="checkbox" v-model="evidenceChecks[1]" /> 平台APP注册信息截图（手机号、实名认证）</label>
                <label><input type="checkbox" v-model="evidenceChecks[2]" /> 工牌/工服/配送箱（拍照存档）</label>
                <label><input type="checkbox" v-model="evidenceChecks[3]" /> 银行流水（标注"XX平台报酬"的记录）</label>
                <label><input type="checkbox" v-model="evidenceChecks[4]" /> 微信/QQ工作群聊天记录</label>
                <label><input type="checkbox" v-model="evidenceChecks[5]" /> 考勤记录/系统派单记录（APP内导出或截图）</label>
                <label><input type="checkbox" v-model="evidenceChecks[6]" /> 平台服务协议/注册时签署的电子合同</label>
              </div>
            </div>

            <div class="checklist-section">
              <h4>侵权事实证明（你被侵害了什么）</h4>
              <div class="checklist">
                <label><input type="checkbox" v-model="evidenceChecks[7]" /> 工资单/收入明细截图（含扣款记录及原因）</label>
                <label><input type="checkbox" v-model="evidenceChecks[8]" /> 派单/计价规则变化前后的对比截图</label>
                <label><input type="checkbox" v-model="evidenceChecks[9]" /> 罚款/扣款通知及依据</label>
                <label><input type="checkbox" v-model="evidenceChecks[10]" /> 账号冻结/封号通知及历史接单记录</label>
                <label><input type="checkbox" v-model="evidenceChecks[11]" /> 诊断证明/病历（工伤场景）</label>
                <label><input type="checkbox" v-model="evidenceChecks[12]" /> 工作时间记录（系统打卡/在线时长截图）</label>
              </div>
            </div>

            <div class="checklist-section">
              <h4>取证技巧</h4>
              <ul class="tips">
                <li>截图需包含<strong>完整时间+平台标识</strong>,有效取证应含水电平和通知栏</li>
                <li>重要录屏/录像：通过<strong>可信时间戳</strong>（www.tsa.cn，联合信任时间戳服务中心）或<strong>公证云</strong>等工具认证，效力更高</li>
                <li>银行流水去银行柜台打印并<strong>盖业务章</strong>，效力大于自行截图</li>
                <li>与平台客服沟通尽量选择<strong>在线工单/邮件</strong>（有书面记录），避免纯电话沟通</li>
                <li>所有电子证据至少保留<strong>两份副本</strong>（云端+本地），防止丢失</li>
              </ul>
            </div>

            <n-alert type="warning" :show-icon="true">
              <strong>证据灭失风险：</strong>平台可能在争议发生后删除你的APP端历史记录。务必在发现侵权的第一时间完成全部截图。
            </n-alert>
          </div>
        </n-card>

        <!-- Step 2: Platform appeal -->
        <n-card v-if="activeStep === 'appeal'" class="card" title="第2步 — 平台内部申诉">
          <div class="step-body">
            <p class="step-intro">大部分争议通过平台申诉即可解决。此步骤同时也在为后续法律程序积累证据链。</p>

            <div class="checklist-section">
              <h4>申诉渠道</h4>
              <n-table :bordered="false" :single-line="false" size="small">
                <thead><tr><th>渠道</th><th>操作方式</th><th>响应时效</th></tr></thead>
                <tbody>
                  <tr><td>APP内工单</td><td>我的→客服中心→创建工单→详细描述诉求</td><td>一般48h</td></tr>
                  <tr><td>在线客服</td><td>APP/网站→在线客服→要求"升级处理"</td><td>即时</td></tr>
                  <tr><td>电话客服</td><td>官方客服热线→工号记录→要求书面回复</td><td>即时</td></tr>
                  <tr><td>邮件申诉</td><td>查找平台官方邮箱→发送正式邮件（留底）</td><td>1-5天</td></tr>
                  <tr><td>监管平台</td><td>国务院"互联网+督查"平台→直接反映</td><td>15日内</td></tr>
                </tbody>
              </n-table>
            </div>

            <div class="checklist-section">
              <h4>申诉话术模板（可直接复制使用）</h4>
              <div class="template-box">
                <div class="template-title">工资异议申诉</div>
                <div class="template-content">
                  本人（姓名），平台账号（XXX），于（日期）发现（月份）工资发放存在以下问题：<br>
                  应发金额 ¥____，实发金额 ¥____，差额 ¥____。扣款原因标注为"____"，该扣款于法无据/与事实不符。<br>
                  现要求：（1）在3个工作日内书面说明扣款依据；（2）在7个工作日内补发差额；（3）如无法补发，将依法向劳动监察部门投诉或申请劳动仲裁。<br>
                  附件：工资明细截图、扣款通知。
                </div>
              </div>
              <div class="template-box">
                <div class="template-title">账号误封申诉</div>
                <div class="template-content">
                  本人（姓名），平台账号（账号），于____日被通知账号"因违规被永久/暂时封禁"，违规原因标注为"____"。<br>
                  本人认为该判定有误，理由如下：（1）____；（2）____。<br>
                  现要求：（1）恢复账号至正常状态；（2）赔偿封禁期间收入损失 ¥____/天 × ____天 = ¥____；（3）保留进一步举报/诉讼权利。
                </div>
              </div>
            </div>
          </div>
        </n-card>

        <!-- Step 3: Admin complaint -->
        <n-card v-if="activeStep === 'complaint'" class="card" title="第3步 — 行政投诉（免费、快捷）">
          <div class="step-body">
            <p class="step-intro">向政府部门投诉是完全免费的，通常比法院诉讼更快捷。适合事实清楚、金额不大的争议。</p>

            <n-grid :x-gap="12" cols="1 s:2" responsive="screen">
              <n-gi>
                <div class="agency-card">
                  <h4>人力资源和社会保障局</h4>
                  <div class="agency-detail">
                    <p><b>投诉方式：</b>拨打 12333 或前往当地人社局窗口</p>
                    <p><b>适用事项：</b>欠薪、不缴社保、违法解约、超时加班</p>
                    <p><b>时效：</b>违反劳动保障行为在2年内未被发现则不再查处</p>
                    <p><b>所需材料：</b>身份证复印件 + 劳动关系证明 + 侵权事实证据</p>
                  </div>
                </div>
              </n-gi>
              <n-gi>
                <div class="agency-card">
                  <h4>劳动监察大队</h4>
                  <div class="agency-detail">
                    <p><b>投诉方式：</b>现场递交书面投诉材料</p>
                    <p><b>优势：</b>可直接责令平台限期改正并处罚款</p>
                    <p><b>处理时限：</b>立案后60个工作日内完成（可延长30日）</p>
                    <p><b>注意：</b>对处理结果不服仍可申请仲裁</p>
                  </div>
                </div>
              </n-gi>
              <n-gi>
                <div class="agency-card">
                  <h4>市场监管局</h4>
                  <div class="agency-detail">
                    <p><b>投诉方式：</b>拨打 12315 或全国12315平台微信小程序</p>
                    <p><b>适用事项：</b>算法不透明、强制二选一、乱收费、霸王条款</p>
                    <p><b>反垄断：</b>平台恶意压价、排他协议可反垄断举报</p>
                  </div>
                </div>
              </n-gi>
              <n-gi>
                <div class="agency-card">
                  <h4>总工会 / 新业态工会</h4>
                  <div class="agency-detail">
                    <p><b>入会方式：</b>{{ unionEntry }}</p>
                    <p><b>服务内容：</b>免费法律咨询 + 调解 + 法律援助 + 帮扶慰问</p>
                    <p><b>地方特色：</b>{{ unionLocal }}</p>
                  </div>
                </div>
              </n-gi>
            </n-grid>

            <n-divider style="margin:12px 0" />

            <n-alert type="info" :show-icon="true">
              <strong>实操提醒：</strong>投诉前准备好证据清单的复印件（所有材料一式两份）。首次递交时要求收件回执，上面会有"收件日期"，这是后续时效中断的关键凭据。如窗口拒绝收件，要求出具《不予受理通知书》。
            </n-alert>
          </div>
        </n-card>

        <!-- Step 4: Arbitration -->
        <n-card v-if="activeStep === 'arbitration'" class="card" title="第4步 — 劳动仲裁（必经程序）">
          <div class="step-body">
            <p class="step-intro">劳动仲裁是法院诉讼的<strong>前置程序</strong>（除个别情况外），但<strong>完全免费、程序相对简单</strong>，可自行完成无需律师。</p>

            <div class="checklist-section">
              <h4>去哪里申请？</h4>
              <ul class="tips">
                <li>劳动合同履行地（你跑单的当地）或用人单位所在地的劳动人事争议仲裁委员会</li>
                <li>灵活就业者通常向<strong>实际工作行为发生地</strong>（配送地/运营区）仲裁委申请</li>
                <li>可通过当地人社局官网查询仲裁委地址和时间</li>
              </ul>
            </div>

            <div class="checklist-section">
              <h4>申请书模板（可直接参考使用）</h4>
              <div class="template-box">
                <div class="template-title">劳动仲裁申请书</div>
                <div class="template-content">
                  <strong>申请人：</strong>张三，男，汉，19__年__月__日生，住：{{ store.rule?.cityName ?? '____市' }}__区__路__号，电话：138________，身份证号：_________<br>
                  <strong>被申请人：</strong>__科技有限公司，住所：__市__区__路__号<br>
                 法定代表人：__，职务：__<br><br>
                  <strong>仲裁请求：</strong><br>
                  1. 裁决被申请人支付拖欠工资人民币8,000元 × 3个月 = 24,000元；<br>
                  2. 裁决被申请人支付欠薪加付赔偿金12,000元；<br>
                  3. 裁决被申请人支付未签劳动合同双倍工资差额44,000元（8,000 × 5.5个月）。<br><br>
                  <strong>事实与理由：</strong><br>
                  申请人于20__年__月至20__年__月在被申请人__平台，担任外卖骑手一职，双方未签订书面劳动合同。20__年__月至__月，被申请人未按时足额支付劳动报酬，累计拖欠____元。经多次催要未果。<br>
                  综上，被申请人的行为严重违反了《劳动合同法》第30、38、82、85条之规定，为维护申请人合法权益，特向贵委申请仲裁，请依法支持申请人全部仲裁请求。<br><br>
                  此致<br>
                  __市__区劳动人事争议仲裁委员会<br><br>
                          申请人（签名）：张三<br>
                          20__年__月__日<br><br>
                  <strong>附件：</strong>1. 证据清单1份 2. 证据材料__页
                </div>
              </div>
            </div>

            <div class="checklist-section">
              <h4>证据清单格式</h4>
              <div class="template-box">
                <div class="template-title">证据清单与说明</div>
                <div class="template-content">
                  <table>
                    <tr v-for="(ev, i) in evidenceList" :key="i">
                      <td style="width:40px">{{ i+1 }}</td>
                      <td style="width:130px">{{ ev.name }}</td>
                      <td style="width:30px">{{ ev.qty }}</td>
                      <td>{{ ev.purpose }}</td>
                    </tr>
                  </table>
                </div>
              </div>
            </div>

            <div class="checklist-section">
              <h4>仲裁注意事项</h4>
              <ul class="tips">
                <li><strong>时效：</strong>从知道或应当知道权利被侵害之日起<strong>1年内</strong>申请。劳动关系存续期间欠薪无时效限制，但终止后须在1年内提出</li>
                <li><strong>管辖争议：</strong>如被申请人提出管辖权异议（常见策略用于拖延），15日内会有管辖权裁定</li>
                <li><strong>45天审限：</strong>仲裁庭应在立案之日起45日内结案，复杂案件可延长15日</li>
                <li><strong>一步诉讼：</strong>如被申请人收到开庭通知拒不到庭，可缺席裁决</li>
                <li><strong>强制执行：</strong>仲裁裁决生效后被申请人不付钱 — 可直接申请法院强制执行</li>
              </ul>
            </div>
          </div>
        </n-card>

        <!-- Step 5: Litigation -->
        <n-card v-if="activeStep === 'litigation'" class="card" title="第5步 — 法院诉讼（最终手段）">
          <div class="step-body">
            <p class="step-intro">对仲裁裁决不服的，可在收到裁决书之日起<strong>15日内</strong>向法院起诉。一审判决后不服的，15日内向上一级法院上诉。</p>

            <n-grid :x-gap="12" cols="1 s:2" responsive="screen">
              <n-gi>
                <div class="agency-card">
                  <h4>基层法院（一审）</h4>
                  <div class="agency-detail">
                    <p><b>管辖：</b>按仲裁委所在地确定管辖法院</p>
                    <p><b>诉讼费：</b>劳动争议案件固定10元，简易程序5元</p>
                    <p><b>立案方式：</b>线上"人民法院在线服务"微信小程序或现场立案</p>
                    <p><b>审限：</b>简易程序3个月，普通程序6个月</p>
                  </div>
                </div>
              </n-gi>
              <n-gi>
                <div class="agency-card">
                  <h4>中级法院（二审）</h4>
                  <div class="agency-detail">
                    <p><b>时限：</b>收到一审判决书15日内上诉</p>
                    <p><b>效力：</b>二审判决为终审判决，立即生效</p>
                    <p><b>再审：</b>判决生效后可向高院申请再审（不停止执行）</p>
                    <p><b>强制执行：</b>终审后不履行 → 一审法院申请强制执行</p>
                  </div>
                </div>
              </n-gi>
            </n-grid>

            <n-divider style="margin:12px 0" />

            <n-alert type="success" :show-icon="true">
              <strong>好消息：</strong>劳动争议案件诉讼费仅10元（简易程序减半仅5元），且胜诉后诉讼费由败诉方承担。即使不懂法律，也可自行完成整个诉讼程序。法律援助中心可提供免费律师代理。
            </n-alert>
          </div>
        </n-card>
      </n-gi>

      <!-- Sidebar contacts -->
      <n-gi>
        <n-card title="常用联系方式" class="card" style="position:sticky;top:12px">
          <div class="contact-list">
            <div class="contact-item">
              <div class="ci-name">12348 法律援助</div>
              <div class="ci-desc">24小时免费法律咨询 + 法律援助申请</div>
            </div>
            <div class="contact-item">
              <div class="ci-name">12333 人社热线</div>
              <div class="ci-desc">劳动监察举报、社保咨询</div>
            </div>
            <div class="contact-item">
              <div class="ci-name">12351 职工维权</div>
              <div class="ci-desc">总工会职工维权专线</div>
            </div>
            <div class="contact-item">
              <div class="ci-name">12368 法院热线</div>
              <div class="ci-desc">案件查询、诉讼指引</div>
            </div>
            <div class="contact-item">
              <div class="ci-name">12315 市场监管</div>
              <div class="ci-desc">消费投诉、平台违规举报</div>
            </div>
            <div class="contact-item">
              <div class="ci-name">12328 交通运输</div>
              <div class="ci-desc">网约车违规举报</div>
            </div>
          </div>
        </n-card>

        <n-card title="关键时效速查" class="card" style="margin-top: 12px">
          <div class="deadline-list">
            <div class="dl-item">
              <div class="dl-time">1年</div>
              <div class="dl-text">劳动仲裁时效</div>
            </div>
            <div class="dl-item">
              <div class="dl-time">1年</div>
              <div class="dl-text">未签合同双倍工资</div>
            </div>
            <div class="dl-item">
              <div class="dl-time">15日</div>
              <div class="dl-text">不服仲裁→起诉</div>
            </div>
            <div class="dl-item">
              <div class="dl-time">15日</div>
              <div class="dl-text">不服一审→上诉</div>
            </div>
            <div class="dl-item">
              <div class="dl-time">2年</div>
              <div class="dl-text">申请强制执行</div>
            </div>
          </div>
        </n-card>

        <n-card title="法律援助与维权热线" class="card" style="margin-top: 12px">
          <n-alert type="info" :show-icon="true" style="margin-bottom: 10px">
            本页按你当前测算城市（{{ store.rule?.cityName ?? '未选择' }}）所属省份显示资源。
            全国统一热线在任何省份都可直接拨打：
            <b>12348</b> 法律援助 · <b>12333</b> 人社投诉 · <b>12351</b> 工会维权 · <b>12368</b> 法院热线。
          </n-alert>
          <div class="contact-list">
            <div class="contact-item">
              <div class="ci-name">{{ localAidName }}</div>
              <div class="ci-desc">拨打 12348 转本地法律援助中心；经济困难可申请免费律师代理</div>
            </div>
            <div class="contact-item">
              <div class="ci-name">{{ province }}总工会 / 职工服务中心</div>
              <div class="ci-desc">拨打 12351 转本地工会；新就业形态劳动者入会与法律援助均在此办理</div>
            </div>
            <div class="contact-item">
              <div class="ci-name">{{ store.rule?.cityName ?? '本地' }}劳动人事争议仲裁委员会</div>
              <div class="ci-desc">地址与电话请通过当地人社局官网或 12333 查询（仲裁免费，无需律师也可申请）</div>
            </div>
          </div>
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NCard, NAlert, NGrid, NGi, NDivider, NTable } from 'naive-ui'
import { useMainStore } from '../../stores/main'
import { provinceOf } from '../../data/provinces'
import { PROVINCIAL_LEGAL_AID, channelOf } from '../../data/provinceChannels'

const store = useMainStore()
const activeStep = ref('evidence')

/** 当前测算城市所属省份：非广东用户不应看到粤工惠/广州法援等本地资源 */
const province = computed(() => provinceOf(store.rule?.city ?? store.work.city) ?? '你所在省')
const localAidName = computed(() => PROVINCIAL_LEGAL_AID[province.value] ?? `${province.value}法律援助中心（12348 转）`)
const unionEntry = computed(() => {
  const ch = channelOf(province.value)
  if (province.value === '广东') return '微信小程序搜索「粤工惠」→ 新就业形态劳动者入会'
  return ch
    ? `通过「${ch.portalName}」或当地总工会公众号入会；也可拨 12351 由工会指引`
    : '拨 12351 由当地总工会指引入会（新就业形态劳动者可加入所在区域行业工会）'
})
const unionLocal = computed(() => province.value === '广东'
  ? '广州市总工会「骑手之家」提供休息 + 维权一站式服务'
  : `各地工会服务站点差异较大，具体以${province.value}总工会公布为准；12351 可查询最近的户外劳动者服务站点`)

/** 证据清单勾选状态（组件内本地状态，不持久化） */
const evidenceChecks = ref<Record<string, boolean>>({})

const steps = [
  { id: 'evidence', num: '1', name: '固定证据' },
  { id: 'appeal', num: '2', name: '平台申诉' },
  { id: 'complaint', num: '3', name: '行政投诉' },
  { id: 'arbitration', num: '4', name: '劳动仲裁' },
  { id: 'litigation', num: '5', name: '法院诉讼' },
]

const evidenceList = [
  { name: 'APP注册信息截图', qty: '1', purpose: '证明与平台存在服务关系' },
  { name: '银行流水（盖章）', qty: '1', purpose: '证明收入金额及发放规律' },
  { name: '工资明细截图', qty: 'N', purpose: '证明扣款/欠薪数额' },
  { name: '客服工单记录', qty: 'N', purpose: '证明已按平台程序主张权利' },
  { name: '工作时间截图', qty: 'N', purpose: '证明实际劳动时长' },
  { name: '处罚/封号通知', qty: 'N', purpose: '证明平台作出相关决定' },
]
</script>

<style scoped>

.quick-nav {
  display: flex; gap: 0; margin-top: 12px;
  background: var(--color-bg-primary); border: 1px solid var(--color-border-primary); border-radius: 6px;
  overflow-x: auto;
}
.qn-item {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 16px; cursor: pointer;
  border-right: 1px solid var(--color-border-primary); white-space: nowrap;
  transition: background 0.15s;
}
.qn-item:last-child { border-right: none; }
.qn-item:hover { background: var(--color-bg-secondary); }
.qn-item.active { background: var(--color-primary-500); color: var(--color-text-inverse); }
.qn-num {
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--color-bg-tertiary); color: var(--color-text-secondary);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
}
.qn-item.active .qn-num { background: rgba(255,255,255,0.25); color: var(--color-text-inverse); }
.qn-name { font-size: 13px; font-weight: 500; }

.step-body { display: flex; flex-direction: column; gap: 10px; }
.step-intro { color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; margin-bottom: 0; }

.checklist-section h4 {
  font-size: 13px; font-weight: 600; color: var(--color-text-primary);
  margin-bottom: 6px;
}

.checklist {
  display: flex; flex-direction: column; gap: 4px;
}
.checklist label {
  display: flex; align-items: flex-start; gap: 6px;
  font-size: 12px; color: var(--color-text-secondary); cursor: pointer;
  padding: 3px 0;
}
.checklist input[type="checkbox"] {
  margin-top: 2px; width: 14px; height: 14px; accent-color: var(--color-text-brand);
}

.tips {
  padding-left: 18px;
  margin: 0;
}
.tips li {
  font-size: 12px; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 3px;
}

.template-box {
  border: 1px solid var(--color-border-primary); border-radius: 4px;
  overflow: hidden;
}
.template-box + .template-box { margin-top: 6px; }
.template-title {
  padding: 6px 12px; background: var(--color-bg-secondary);
  font-size: 11px; font-weight: 600; color: var(--color-text-brand);
  border-bottom: 1px solid var(--color-border-primary);
}
.template-content {
  padding: 10px 12px; font-size: 12px; color: var(--color-text-secondary);
  line-height: 1.7;
}

.agency-card {
  border: 1px solid var(--color-border-primary); border-radius: 4px;
  padding: 12px;
}
.agency-card h4 {
  font-size: 13px; font-weight: 600; color: var(--color-text-primary);
  margin-bottom: 6px; padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border-primary);
}
.agency-detail {
  display: flex; flex-direction: column; gap: 2px;
}
.agency-detail p {
  font-size: 12px; color: var(--color-text-secondary); margin: 0;
}

.contact-list {
  display: flex; flex-direction: column; gap: 8px;
}
.contact-item {
  padding: 6px 0; border-bottom: 1px solid var(--color-bg-tertiary);
}
.contact-item:last-child { border-bottom: none; }
.ci-name {
  font-size: 13px; font-weight: 600; color: var(--color-text-brand);
}
.ci-desc {
  font-size: 11px; color: var(--color-text-tertiary); margin-top: 2px;
}

.deadline-list {
  display: flex; flex-direction: column; gap: 6px;
}
.dl-item {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0;
}
.dl-time {
  width: 32px; text-align: center;
  font-size: 11px; font-weight: 700;
  color: var(--color-text-danger); background: var(--color-danger-50);
  border-radius: 3px; padding: 2px 4px;
}
.dl-text {
  font-size: 12px; color: var(--color-text-secondary);
}
</style>
