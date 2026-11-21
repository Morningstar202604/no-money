/**
 * 依赖边界门禁：只看「有没有环」，不重写 import 风格。
 *
 * 为什么需要它：TypeScript 的循环 import 在类型层通常无感，一旦变成运行时
 * 单例（store / composable / 常量）就会在某个加载顺序下变成 undefined。
 * 这种 bug 本地难复现，靠人 review 也看不出来，必须让机器扫。
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        '循环依赖会让运行时单例在某个入口顺序下变成 undefined；拆到共享下层或改用事件解耦。',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(node_modules|dist|coverage|test-results|playwright-report)' },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.vue', '.js', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}
