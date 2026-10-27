/**
 * ECharts 懒加载与模块注册（ChartBox 与地图组件共用）。
 *
 * 首次调用时才动态 import，注册一次后复用；地图相关（MapChart/GeoComponent）
 * 也在这里注册。
 *
 * 已知取舍：`echarts/charts` / `echarts/components` 是 barrel，会把全部图表
 * 类型打进 chunk（实测 884 KB / gzip 294 KB），删掉未注册项也不会减小。
 * 想真正减重需改成 `echarts/lib/chart/bar` 这类精确路径，但 ECharts 6 的
 * lib 目录没有类型声明（TS7016），需手写 declare module——用类型安全换体积
 * 不划算。该 chunk 是懒加载块，首屏不加载，故保持现状。
 */

let initFn: typeof import('echarts/core').init | null = null
let registerMapFn: typeof import('echarts/core').registerMap | null = null
let isRegistered = false

export async function ensureECharts(): Promise<{
  init: typeof import('echarts/core').init
  registerMap: typeof import('echarts/core').registerMap
}> {
  if (initFn && registerMapFn) return { init: initFn, registerMap: registerMapFn }

  const [{ init, registerMap }, { use }, { CanvasRenderer }, charts, components] = await Promise.all([
    import('echarts/core'),
    import('echarts/core'),
    import('echarts/renderers'),
    import('echarts/charts'),
    import('echarts/components'),
  ])

  if (!isRegistered) {
    use([
      CanvasRenderer,
      charts.BarChart, charts.LineChart, charts.PieChart, charts.ScatterChart,
      charts.HeatmapChart, charts.MapChart,
      components.TitleComponent, components.TooltipComponent, components.LegendComponent,
      components.GridComponent, components.VisualMapComponent, components.DatasetComponent,
      components.ToolboxComponent, components.DataZoomComponent,
      components.DataZoomInsideComponent, components.DataZoomSliderComponent,
      components.GeoComponent,
    ])
    isRegistered = true
  }

  initFn = init
  registerMapFn = registerMap
  return { init: initFn, registerMap: registerMapFn }
}
