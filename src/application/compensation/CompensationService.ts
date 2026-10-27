import type { CompensationItem, CompensationLegalRef, CompensationResult } from '../../types';
import { err, Result, tryCatch } from '../../domain/shared/result';
import { AppError } from '../errors';
import { provinceOf } from '../../data/provinces';

/** 补偿计算输入参数 */
export interface CompensationInput {
  /** 场景类型 */
  scene: 'wage' | 'injury' | 'dismiss' | 'algorithm' | 'overwork';
  /** 表单参数 */
  form: CompensationForm;
  /** 城市规则（用于获取社平工资上下限） */
  rule: {
    benefit: {
      pension: { baseMin: number; baseMax: number };
    };
    minimumWage: { nonFullTimeHourly: number };
    /** 城市 id：用于判断地方性工伤保险口径（一次性医疗/就业补助金月数由省级规定） */
    city?: string;
  };
}

/** 补偿计算表单参数（各场景通用） */
export interface CompensationForm {
  wage?: {
    months: number;
    monthly: number;
    percent: number;
    tenureMonths: number;
    hasContract: boolean;
    forcedQuit: boolean;
  };
  injury?: {
    level: number;
    medical: number;
    leaveMonths: number;
    income: number;
    hasInsurance: boolean;
    mealPerDay: number;
    nursingPerDay: number;
  };
  dismiss?: {
    years: number;
    monthly: number;
    type: 'wrongful' | 'no_notice' | 'protected' | 'retaliatory';
    pregnancyMonths: number;
  };
  algo?: {
    type: 'unfair_dispatch' | 'price_suppress' | 'unfair_penalty' | 'account_ban' | 'exclusivity';
    loss: number;
    duration: number;
    hasLaborRelation: boolean;
  };
  overwork?: {
    hourlyBase: number;
    weekdayHours: number;
    weekendHours: number;
    holidayHours: number;
    months: number;
  };
}

/**
 * CompensationService - 权益补偿计算服务
 * 参考 RightsCompensation.vue 逻辑，提取为可复用的应用层服务
 * 返回 Result<CompensationResult, AppError>
 */
/**
 * 是否适用《广东省工伤保险条例》口径。
 * 按省份判定而不是城市白名单：佛山/珠海/中山没有内置规则文件，但同属广东，
 * 用三个城市的 Set 会把它们判成外省，工伤补助金月数直接不展示。
 */
const isGuangdong = (city?: string) => provinceOf(city) === '广东'

export class CompensationService {
  /** 计算补偿 */
  calculate(input: CompensationInput): Result<CompensationResult, AppError> {
    // 输入校验
    const validationErr = this.validateInput(input);
    if (validationErr) return err(validationErr);

    return tryCatch(() => {
      const { scene, form, rule } = input;
      const { floor, ceil } = this.getWageBand(rule);

      let result: CompensationResult;

      switch (scene) {
        case 'wage':
          result = this.calcWage(form.wage!);
          break;
        case 'injury':
          result = this.calcInjury(form.injury!, floor, ceil, rule.city);
          break;
        case 'dismiss':
          result = this.calcDismiss(form.dismiss!, ceil);
          break;
        case 'algorithm':
          result = this.calcAlgo(form.algo!);
          break;
        case 'overwork':
          result = this.calcOverwork(form.overwork!, rule.minimumWage.nonFullTimeHourly);
          break;
        default:
          throw AppError.compensationSceneUnsupported(scene);
      }

      return result;
    }, (e) => AppError.engine('CompensationService', e instanceof Error ? e.message : String(e), { input }));
  }

  /** 获取工资上下限（用于封顶保底） */
  private getWageBand(rule: CompensationInput['rule']): { floor: number; ceil: number } {
    const p = rule.benefit.pension;
    return { floor: p?.baseMin ?? 0, ceil: p?.baseMax ?? Infinity };
  }

  /** 《劳动合同法》第47条：满1年=1个月，满6个月不满1年=1个月，不满6个月=0.5个月 */
  private severanceMonths(years: number): number {
    const full = Math.floor(years);
    const rest = years - full;
    return rest >= 0.5 ? full + 1 : full + (rest > 0 ? 0.5 : 0);
  }

  /** 创建可直接主张项 */
  private claim(name: string, amount: number, note: string): CompensationItem {
    return { name, amount: Math.round(amount), note, kind: 'claim' };
  }

  /** 创建条件项（需前置条件） */
  private cond(name: string, amount: number, note: string): CompensationItem {
    return { name, amount: Math.round(amount), note, kind: 'conditional' };
  }

  /** 创建说明项（无金额） */
  private info(name: string, note: string): CompensationItem {
    return { name, amount: 0, note, kind: 'info' };
  }

  /** 打包结果：合计只累加 claim，conditional 与 info 单列 */
  private pack(items: CompensationItem[], legalRefs: CompensationLegalRef[], sceneName: string): CompensationResult {
    return {
      scene: sceneName,
      total: items.filter((i) => i.kind === 'claim').reduce((s, i) => s + i.amount, 0),
      conditionalTotal: items.filter((i) => i.kind === 'conditional').reduce((s, i) => s + i.amount, 0),
      items,
      legalRefs,
    };
  }

  /** 校验输入 */
  private validateInput(input: CompensationInput): AppError | null {
    if (!input.scene) return AppError.validation('Scene is required');
    if (!input.form) return AppError.validation('Form data is required');
    if (!input.rule) return AppError.validation('City rule is required');

    const { scene, form } = input;

    switch (scene) {
      case 'wage':
        if (!form.wage) return AppError.validation('Wage form data is required');
        if (form.wage.months <= 0 || form.wage.months > 24) return AppError.validation('wage.months must be 1-24');
        if (form.wage.monthly < 0) return AppError.validation('wage.monthly must be >= 0');
        if (form.wage.percent <= 0 || form.wage.percent > 100) return AppError.validation('wage.percent must be 1-100');
        if (form.wage.tenureMonths <= 0 || form.wage.tenureMonths > 24) return AppError.validation('wage.tenureMonths must be 1-24');
        break;
      case 'injury':
        if (!form.injury) return AppError.validation('Injury form data is required');
        if (form.injury.level < 0 || form.injury.level > 10) return AppError.validation('injury.level must be 0-10');
        if (form.injury.medical < 0) return AppError.validation('injury.medical must be >= 0');
        if (form.injury.leaveMonths < 0 || form.injury.leaveMonths > 24) return AppError.validation('injury.leaveMonths must be 0-24');
        if (form.injury.income < 0) return AppError.validation('injury.income must be >= 0');
        break;
      case 'dismiss':
        if (!form.dismiss) return AppError.validation('Dismiss form data is required');
        if (form.dismiss.years < 0 || form.dismiss.years > 20) return AppError.validation('dismiss.years must be 0-20');
        if (form.dismiss.monthly < 0) return AppError.validation('dismiss.monthly must be >= 0');
        break;
      case 'algorithm':
        if (!form.algo) return AppError.validation('Algorithm form data is required');
        if (form.algo.loss < 0) return AppError.validation('algo.loss must be >= 0');
        if (form.algo.duration <= 0 || form.algo.duration > 24) return AppError.validation('algo.duration must be 1-24');
        break;
      case 'overwork':
        if (!form.overwork) return AppError.validation('Overwork form data is required');
        if (form.overwork.hourlyBase < 0) return AppError.validation('overwork.hourlyBase must be >= 0');
        if (form.overwork.weekdayHours < 0 || form.overwork.weekdayHours > 200) return AppError.validation('overwork.weekdayHours must be 0-200');
        if (form.overwork.weekendHours < 0 || form.overwork.weekendHours > 200) return AppError.validation('overwork.weekendHours must be 0-200');
        if (form.overwork.holidayHours < 0 || form.overwork.holidayHours > 100) return AppError.validation('overwork.holidayHours must be 0-100');
        if (form.overwork.months <= 0 || form.overwork.months > 24) return AppError.validation('overwork.months must be 1-24');
        break;
    }

    return null;
  }

  /** 计算欠薪/克扣报酬场景 */
  private calcWage(form: NonNullable<CompensationForm['wage']>): CompensationResult {
    const { months, monthly, percent, tenureMonths, hasContract, forcedQuit } = form;
    const owed = monthly * (percent / 100) * months;

    const items: CompensationItem[] = [
      this.claim('欠付报酬本金', owed, `\u00A5${monthly} \u00D7 ${percent}% \u00D7 ${months}个月`),
      this.cond('加付赔偿金 50%–100%', owed * 0.5, '《劳动合同法》第85条以"劳动行政部门责令限期支付、逾期不付"为前置条件，未经责令程序不成立，故不计入合计'),
    ];

    if (!hasContract) {
      const doubleMonths = Math.max(0, Math.min(tenureMonths - 1, 11));
      items.push(
        this.cond(
          '未订书面劳动合同二倍工资差额',
          monthly * doubleMonths,
          `按用工月数 ${tenureMonths} 个月计算第2个月起最多11个月：${doubleMonths} 个月 \u00D7 \u00A5${monthly}。广东裁审倾向按"每月分别起算1年时效"，逾期部分可能不被支持`,
        ),
      );
    }

    if (forcedQuit) {
      items.push(
        this.cond(
          '因欠薪被迫解除的经济补偿（N）',
          monthly * this.severanceMonths(tenureMonths / 12),
          '《劳动合同法》第38、46条：以欠薪为由解除劳动合同可主张经济补偿，需先向单位送达解除通知',
        ),
      );
    }

    items.push(this.info('时效提醒', '劳动报酬争议在劳动关系存续期间不受1年时效限制；关系终止后须自终止之日起1年内申请（调解仲裁法第27条第4款）'));

    return this.pack(items, [
      { law: '劳动合同法', article: '30', summary: '用人单位应当按时足额支付劳动报酬' },
      { law: '劳动合同法', article: '82', summary: '用工超过1个月不满1年未订立书面合同的，支付二倍工资' },
      { law: '劳动合同法', article: '85', summary: '经责令限期支付而逾期不付，按应付金额50%–100%加付赔偿金' },
      { law: '劳动争议调解仲裁法', article: '27', summary: '仲裁时效1年；欠薪在关系存续期间不受限，终止后1年内提出' },
    ], '欠薪/克扣报酬');
  }

  /** 计算职业伤害/工伤场景 */
  private calcInjury(form: NonNullable<CompensationForm['injury']>, floor: number, ceil: number, city?: string): CompensationResult {
    const { level, medical, leaveMonths, income, hasInsurance, mealPerDay, nursingPerDay } = form;

    // 工伤保险条例第64条：本人工资低于统筹地区职工平均工资60%的按60%，高于300%的按300%
    const ownWage = Math.min(Math.max(income, floor), ceil);

    const items: CompensationItem[] = [
      this.claim('医疗费（据实）', medical, '以工伤医疗机构发生的、符合目录的费用凭据为准，保留发票与住院清单原件'),
      this.claim('停工留薪期原工资福利', ownWage * leaveMonths, `按本人工资 \u00A5${ownWage} \u00D7 ${leaveMonths} 个月。停工留薪期一般不超过12个月，伤情严重经设区的市级劳动能力鉴定委员会确认可延长不超过12个月`),
    ];

    if (mealPerDay > 0) {
      items.push(this.claim('住院伙食补助费', mealPerDay * leaveMonths * 30, `按统筹地区标准填写（每日金额需以当地规定为准，本工具不内置未经核实的数字）。天数按停工留薪期 ${leaveMonths} 个月 × 30 天折算——若实际住院短于停工留薪期，请按实际住院天数自行核减`));
    }
    if (nursingPerDay > 0) {
      items.push(this.claim('生活护理费', nursingPerDay * leaveMonths * 30, '生活不能自理需护理的，由用人单位负责或按当地护理费标准。天数按停工留薪期折算，若实际住院/护理期更短请自行核减'));
    }

    // 一次性伤残补助金月数：全国统一（工伤保险条例第35–37条），可跨省使用
    const subsidy: Record<number, number> = { 10: 7, 9: 9, 8: 11, 7: 13, 6: 16, 5: 18, 4: 21, 3: 23, 2: 25, 1: 27 };
    /**
     * 一次性工伤医疗补助金 / 就业补助金月数：**由省级人民政府规定**，各省不同。
     * 下表仅是广东省口径（广东省工伤保险条例第34条，2019修正）。
     * 此前对 15 城一律套用广东月数，北京/上海/成都等用户会被算出错误金额——
     * 非广东城市改为只给「按当地省级标准核定」的提示，不编造数字。
     */
    const inGuangdong = isGuangdong(city);
    const medFund: Record<number, number> = { 10: 1, 9: 2, 8: 4, 7: 6, 6: 8, 5: 10 };
    const jobFund: Record<number, number> = { 10: 4, 9: 8, 8: 15, 7: 25, 6: 40, 5: 50 };

    if (level >= 5 && level <= 10) {
      items.push(this.claim(`一次性伤残补助金（${level}级 · ${subsidy[level]}个月本人工资）`, ownWage * subsidy[level], '《工伤保险条例》第35–37条月数表（全国统一），由工伤保险基金支付'));
      if (inGuangdong) {
        items.push(this.cond(`一次性工伤医疗补助金（广东 ${level}级 · ${medFund[level]}个月）`, ownWage * medFund[level], '广东省工伤保险条例第34条：以劳动合同期满终止或本人提出解除为前提，由工伤保险基金支付'));
        items.push(this.cond(`一次性伤残就业补助金（广东 ${level}级 · ${jobFund[level]}个月）`, ownWage * jobFund[level], '广东省工伤保险条例第34条：同上以劳动关系解除/终止为前提，由用人单位支付'));
      } else {
        items.push(this.info(
          '一次性工伤医疗/就业补助金：需按你所在省标准核定',
          '这两项的月数由省级人民政府规定，各省差异很大（广东五级为医疗10个月、就业50个月，其他省份从数个月到数十个月不等）。本工具只内置了广东口径，为避免给你一个错误金额，此处不估算——请查你所在省的《工伤保险条例》实施办法或咨询 12333。',
        ));
      }
    } else if (level >= 1 && level <= 4) {
      // 1–4 级：一次性补助金照发，但不享受一次性医疗/就业补助金（那是 5–10 级的退出结算），
      // 改为法定按月伤残津贴直至退休——此前两个分支都不落，四级少算 21 个月补助金与全部津贴
      const allowancePct = { 1: 0.9, 2: 0.85, 3: 0.8, 4: 0.75 }[level] ?? 0;
      const allowancePctLabel = { 1: 90, 2: 85, 3: 80, 4: 75 }[level] ?? 0;
      items.push(this.claim(`一次性伤残补助金（${level}级 · ${subsidy[level]}个月本人工资）`, ownWage * subsidy[level], '《工伤保险条例》第35–38条月数表，由工伤保险基金支付'));
      items.push(this.cond(
        `按月伤残津贴（${level}级 · 本人工资的${allowancePctLabel}%）`,
        ownWage * allowancePct,
        `《工伤保险条例》第35、36条：每月发放直至退休，按月计发、金额显示为一个月的津贴，不并入上方一次性合计；伤残津贴实际金额低于最低工资标准的由工伤保险基金补差，未参保期间由用人单位支付`,
      ));
    } else if (level === 0) {
      items.push(this.info('尚未进行劳动能力鉴定', '伤残等级决定一次性补助金有无与月数，建议先申请劳动能力鉴定再主张'));
    }

    if (!hasInsurance) {
      items.push(this.info('未参加工伤保险的后果', '《工伤保险条例》第62条：应当参保而未参保期间发生工伤的，由用人单位按照条例规定的待遇项目和标准支付全部费用'));
    } else {
      items.push(this.info('职业伤害保障与工伤保险的区别', '平台按单缴费的职业伤害保障试点待遇项目少于工伤保险（通常无一次性伤残补助金/就业补助金），两者不可混同计算'));
    }

    const refs: CompensationLegalRef[] = [
      { law: '工伤保险条例', article: '33、35–38', summary: '停工留薪期原工资福利待遇不变；一次性伤残补助金按等级月数支付；1–4级另按月发放伤残津贴' },
      { law: '工伤保险条例', article: '64', summary: '本人工资为前12个月平均月缴费工资，低于60%或高于300%的按60%/300%计' },
      { law: '工伤保险条例', article: '62', summary: '未参保期间发生工伤，由用人单位按条例项目和标准支付' },
    ];
    // 地方性法规只在适用省份引用：给北京用户打印「《广东省工伤保险条例》第34条」
    // 会直接把错误法条写进仲裁申请书
    if (inGuangdong) {
      refs.push({ law: '广东省工伤保险条例', article: '34', summary: '一次性工伤医疗补助金五级10月至十级1月；一次性伤残就业补助金五级50月至十级4月' });
    } else {
      refs.push({
        law: '你所在省的工伤保险实施办法',
        article: '一次性工伤医疗补助金 / 伤残就业补助金条款（文号待核）',
        summary: '这两项的月数由省级人民政府规定，各省差异很大；本工具未收录该省月数，请以本省实施办法为准，或拨 12333 核实',
      });
    }
    return this.pack(items, refs, '职业伤害/工伤');
  }

  /** 计算违法解约场景 */
  private calcDismiss(form: NonNullable<CompensationForm['dismiss']>, ceil: number): CompensationResult {
    const { years, monthly, type, pregnancyMonths } = form;
    const capped = Math.min(monthly, ceil);
    const yearsCapped = monthly > ceil ? Math.min(years, 12) : years;
    const n = this.severanceMonths(yearsCapped);

    const items: CompensationItem[] = [];

    if (type === 'wrongful' || type === 'protected' || type === 'retaliatory') {
      items.push(
        this.claim(
          `违法解除赔偿金 2N（N=${n}）`,
          2 * n * capped,
          `《劳动合同法》第87条：按第47条经济补偿标准的二倍。月工资超过全省社平300%时，按300%=\u00A5${capped}元计且年限封顶12年（第47条第2款）`,
        ),
      );
    } else {
      items.push(this.claim(`经济补偿金 N（${n} 个月）`, n * capped, '第46、47条：每满1年支付1个月工资，满6个月不满1年按1年，不满6个月按半个月'));
      items.push(this.cond('代通知金（+1个月）', capped, '第40条：仅在医疗期满不能工作、不能胜任经培训调岗后仍不能胜任、客观情况重大变化三种情形且未提前30日书面通知时才支付；与2N不可并用'));
    }

    if (type === 'protected') {
      items.push(
        this.cond(
          '三期工资损失（解除之日至哺乳期满）',
          capped * pregnancyMonths,
          `按 ${pregnancyMonths} 个月计算（需自行填写，哺乳期满通常为婴儿满1周岁）。广东裁审对"是否支持整个三期工资"口径不一，不作为确定可主张项`,
        ),
      );
      if (pregnancyMonths === 0) items.push(this.info('三期案件需填写月数', '未填写月数则此项按0计，建议先咨询12348或工会法援'));
    }

    if (type === 'retaliatory') {
      items.push(this.info('报复性解雇与精神损害赔偿', '劳动争议仲裁通常不受理精神损害赔偿请求；可另行以侵权之诉主张，但胜诉与金额均不确定，故不计入合计'));
    }

    items.push(this.info('举证要点', '解除通知、APP封号/清退截图、工资流水、工牌工服与派单记录是认定劳动关系与解除违法性的关键证据'));

    return this.pack(items, [
      { law: '劳动合同法', article: '40', summary: '三种情形下未提前30日书面通知的，额外支付1个月工资' },
      { law: '劳动合同法', article: '42', summary: '孕期、产期、哺乳期内及工伤医疗期内不得依第40、41条解除' },
      { law: '劳动合同法', article: '47', summary: '经济补偿按工作年限计；高收入者基数封顶3倍社平、年限封顶12年' },
      { law: '劳动合同法', article: '87', summary: '违法解除按经济补偿标准的二倍支付赔偿金' },
    ], '违法解约');
  }

  /** 计算平台算法/处罚争议场景 */
  private calcAlgo(form: NonNullable<CompensationForm['algo']>): CompensationResult {
    const { loss, duration, hasLaborRelation } = form;

    const items: CompensationItem[] = [
      this.cond('收入差额/扣分损失', loss * duration, `月均 \u00A5${loss} \u00D7 ${duration} 个月。需先证明损失与算法规则之间的因果关系`),
      this.info('律师费与公证费', '广东劳动争议仲裁与诉讼一般不支持由败诉方承担律师费，故不计入可主张金额；小额诉讼可自行完成'),
      this.info('可并行主张的渠道', '①向平台申诉并要求书面说明算法依据；②向人社部门、市场监管部门投诉算法规则未公示；③个人主张自动化决策解释权（个保法第24条）'),
      // 劳动关系直接影响救济路径与成本：有劳动关系可走劳动仲裁（不收费、举证责任较轻），
      // 无则只能民事诉讼（自行举证、可能承担诉讼费）。此前该开关被解构后完全未使用，
      // 用户切换了也没有任何反馈——属于「假控件」。
      hasLaborRelation
        ? this.info('救济路径：劳动仲裁（你已确认劳动关系）', '可向劳动人事争议仲裁委员会申请仲裁，不收费。平台算法规则属用人单位规章制度，未经民主程序制定或未向你公示的，对你不产生约束力。')
        : this.info('救济路径：民事诉讼（未确认劳动关系）', '若无劳动关系，只能以合同/侵权为由提起民事诉讼，需自行证明平台规则不公与损失因果，举证难度与成本都更高。建议同时向人社、市场监管部门投诉算法未公示。'),
    ];

    return this.pack(items, [
      { law: '个人信息保护法', article: '24', summary: '自动化决策应保证透明度与结果公平公正，不得实行不合理差别待遇' },
      { law: '互联网信息服务算法推荐管理规定', article: '22', summary: '向劳动者提供便捷的申诉渠道，健全投诉处理机制' },
      { law: '关于维护新就业形态劳动者劳动保障权益的指导意见', article: '人社部发〔2021〕56号', summary: '平台应完善算法规则并向劳动者公示，听取工会和劳动者意见' },
    ], '平台算法/处罚争议');
  }

  /** 计算超时加班费场景 */
  private calcOverwork(form: NonNullable<CompensationForm['overwork']>, minHourlyWage: number): CompensationResult {
    const { hourlyBase, weekdayHours, weekendHours, holidayHours, months } = form;

    const weekdayPay = weekdayHours * 1.5 * hourlyBase * months;
    const weekendPay = weekendHours * 2 * hourlyBase * months;
    const holidayPay = holidayHours * 3 * hourlyBase * months;

    const items: CompensationItem[] = [];

    if (weekdayHours > 0) items.push(this.claim('工作日延时加班费（1.5倍）', weekdayPay, `${weekdayHours}h/月 \u00D7 1.5 \u00D7 \u00A5${hourlyBase}/h \u00D7 ${months}个月`));
    if (weekendHours > 0) items.push(this.claim('休息日加班费（2倍）', weekendPay, `${weekendHours}h/月 \u00D7 2 \u00D7 \u00A5${hourlyBase}/h \u00D7 ${months}个月（不能安排补休时才支付2倍）`));
    if (holidayHours > 0) items.push(this.claim('法定节假日加班费（3倍）', holidayPay, `${holidayHours}h/月 \u00D7 3 \u00D7 \u00A5${hourlyBase}/h \u00D7 ${months}个月`));

    // 最低小时工资是时薪基数的法定下限：基数低于它说明用工本身已违法，
    // 此前该参数被静默丢弃，用户填 10 元/时也照常算出「可主张金额」
    if (hourlyBase > 0 && hourlyBase < minHourlyWage) {
      items.push(this.info('加班费基数低于最低小时工资', `你填写的时薪 ¥${hourlyBase} 低于本城非全日制最低小时工资 ¥${minHourlyWage}——该约定本身不合法，主张时应按不低于 ¥${minHourlyWage}/h 计算，上列金额因此偏低`));
    }

    if (weekdayHours > 36) items.push(this.info('工时合法性提示', `${weekdayHours}h/月 已超《劳动法》第41条每月不超过36小时的上限`));

    if (items.every((i) => i.amount === 0)) items.push(this.info('当前参数下无加班费主张', '工作日延时、休息日、法定节假日小时数均为0'));

    items.push(this.info('适用前提', '加班费请求权以存在劳动关系为前提；经人社部门审批实行不定时工作制的人员一般不适用延时与休息日加班费。灵活就业骑手多数被认定为非劳动关系，此项很可能不成立'));

    return this.pack(items, [
      { law: '劳动法', article: '41', summary: '一般每日加班不超过1小时，特殊原因不超过3小时，每月不超过36小时' },
      { law: '劳动法', article: '44', summary: '延时1.5倍；休息日不能补休2倍；法定休假日3倍' },
    ], '超时加班费');
  }
}