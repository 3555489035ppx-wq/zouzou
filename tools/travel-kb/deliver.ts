import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { KnowledgeStore, atomicJson } from './store'
import { root, docs, workspace, report, codeHash } from './cli'
import { hash } from './pipeline'

const specs: Record<number, { status?: string; detail: string; qa: number[]; files: string[] }> = {
  1: { detail: '保存初始 Git 状态、关键哈希；仅对 planner 与 TS include 作局部追加。', qa: [2], files: ['workspace-baseline.md', 'initial-baseline.json'] },
  2: { detail: '记录 user_statement；读取、导出、模型和运行用途分开。', qa: [12], files: ['scope.md', '../../tools/travel-kb/config/policy.json'] },
  3: { detail: '复查工具、运行环境、已有数据、浏览器与可见 Androws 目录，选择 R0+R6。', qa: [1, 2, 9], files: ['capability-matrix.json', 'gooh/access-checks.json'] },
  4: { detail: '完整 URL 白名单、GET 语义、公开 DNS 固定连接与私密对象排除。', qa: [3, 4, 5, 9, 11], files: ['../../tools/travel-kb/network.ts'] },
  5: { detail: '限定研究目录和明确文件盘点，哈希复用；来源命名不等于产品归属。', qa: [2, 20], files: ['gooh/local-assets.md'] },
  6: { detail: '14个内容面逐项标记；没有本轮详情证据的全部明确 BLOCKED。', qa: [24], files: ['gooh/page-map.md'] },
  7: { status: 'BLOCKED', detail: '未取得可检查的 Gooh 客户端构建/源码；框架、版本与内部存储未知。', qa: [9], files: ['gooh/client-structure.md'] },
  8: { status: 'BLOCKED', detail: '没有本轮正常详情/Day/分页的数据流；不编端点。', qa: [3, 4], files: ['gooh/normal-data-flow.md'] },
  9: { detail: 'JSON/JSONL/CSV/显式HTML导出与文本/图像降级已测；Gooh分享格式仍未知。', qa: [23, 24], files: ['gooh/share-export-map.md'] },
  10: { detail: '游标去重、空尾页、未知total和预算停止均有固定测试；不是Gooh全量遍历。', qa: [13, 14, 15, 16, 19], files: ['../../tools/travel-kb/network.ts', 'gooh/coverage.md'] },
  11: { status: 'BLOCKED', detail: '真实Gooh攻略0条。Chrome调试器未连接、原生控制禁用、无已登记正文入口；本地导入正常。', qa: [1, 57], files: ['gooh/access-checks.json'] },
  12: { detail: '请求预算、响应大小、超时、Retry-After秒/日期、有限重试和断路均通过模拟响应验证。', qa: [6, 7, 8, 17, 18, 19], files: ['../../tools/travel-kb/network.ts'] },
  13: { detail: 'SQLite事务、队列和检查点；子进程在未提交事务中退出后游标及已提交资料完整。', qa: [22, 60], files: ['../../tools/travel-kb/store.ts'] },
  14: { detail: '先白名单和递归脱敏再持久化；隔离仅存原因和哈希。', qa: [5, 40], files: ['results/privacy.md'] },
  15: { detail: '8份JSON Schema和业务校验，来源/证据/真假/单位明确；映射来自真实本地文件。', qa: [25, 26, 27, 29], files: ['gooh/field-mapping.md', '../../src/services/travel-kb/contracts.ts'] },
  16: { detail: '现有14条本地记录确定解析；未知HTML结构显式schema drift，不调用模型搬运JSON。', qa: [2, 23, 26], files: ['../../tools/travel-kb/pipeline.ts'] },
  17: { status: 'BLOCKED', detail: '没有适合入库的Gooh图像攻略/录屏；通用识别队列及哈希可用，未宣称真实OCR完成。', qa: [24], files: ['results/visual-extraction.md'] },
  18: { status: 'BLOCKED', detail: '分块/缓存/预算/一次修复/超时适配已测；实际外发范围和模型预算未配置，语义推理未执行。', qa: [10], files: ['../../tools/travel-kb/extractor.ts', 'environment.md'] },
  19: { detail: '非空claim逐字段回源；observed不升verified，unknown及synthetic禁止运行发布。', qa: [25, 26, 27], files: ['results/quality.md'] },
  20: { detail: '分钟、明确日期偏移、币种最小单位、人均/全员/房晚与坐标系通过测试。', qa: [27, 28, 29, 30, 31, 32], files: ['../../src/services/travel-kb/rules.ts'] },
  21: { detail: '稳定ID/明确地址优先，同名异地不并，缺证据名称相似保留候选。', qa: [32, 33, 34], files: ['../../tools/travel-kb/pipeline.ts'] },
  22: { detail: '合并映射可撤销、保留原源ID和Visit引用；循环与低证据合并被拒。', qa: [34], files: ['../../tools/travel-kb/store.ts'] },
  23: { detail: '文件/记录/路线分开去重；顺序、日期、主题改变保留；复制次数不当独立支持。', qa: [20, 21, 35, 36], files: ['results/deduplication.md'] },
  24: { detail: '同主体属性的重叠时间声明冲突保留各值，不采用最后写入或平均价。', qa: [37, 38], files: ['../../tools/travel-kb/pipeline.ts'] },
  25: { detail: '来源更新/收集/验证/有效期分离；按属性期限和撤回状态过滤。', qa: [37, 39, 58], files: ['../../src/services/travel-kb/retrieval.ts'] },
  26: { detail: '每份路线有G01—20；仅有名词线索的维度为partial，缺失为unknown，未模型填满。', qa: [24, 27, 43], files: ['results/content-gaps.md'] },
  27: { detail: '9个真实已有资料城市形成研究级短单元和缺口；不冒充已核验城市事实。', qa: [2, 48], files: ['results/content-gaps.md'] },
  28: { status: 'BLOCKED', detail: '已抽取本地餐饮说法；来源不含完整逐餐、住宿片区、订单与房晚证据，未造酒店策略。', qa: [28, 43], files: ['results/content-gaps.md'] },
  29: { status: 'BLOCKED', detail: '已有交通文字仅模式词，无可核验起终点/道路耗时；规则参与返程检查，真实Leg证据未具备。', qa: [32, 41, 45], files: ['results/content-gaps.md'] },
  30: { detail: '10个来源支持的候选路线模式，条件/序列/证据簇保留，全部candidate。', qa: [35, 36, 47], files: ['results/deduplication.md'] },
  31: { detail: 'R01—12可执行并返回影响节点/证据/修复；14:45公式、预约、预算、历史保护有固定断言。', qa: [28, 41, 44, 46], files: ['../../src/services/travel-kb/rules.ts'] },
  32: { detail: 'R13—24作为soft/default结果；用户餐期能覆盖规则默认，缓冲没有新增统一硬值。现有排程策略未重写。', qa: [42, 43, 47], files: ['../../src/services/travel-kb/rules.ts'] },
  33: { detail: '替换重算后续时刻/费用；换地点使旧边失效，缺转场证据不称已验证Plan B；保护完成/锁定/TripID。', qa: [45, 46], files: ['../../src/services/travel-kb/rules.ts'] },
  34: { detail: '知识映射到现有evidence、validation、Trip与工具数据；不添加G01—20前台目录。', qa: [53, 55], files: ['integration/knowledge-presentation-map.md'] },
  35: { detail: '先权限/城市/日期/条件过滤，后中文词片段匹配；20个固定规则查询及越界反例通过。', qa: [48, 49], files: ['../../src/services/travel-kb/retrieval.ts'] },
  36: { detail: '不可变release/hash/原子指针、失败保留上一版、手动回滚；仅四条自编规则可进入当前包。', qa: [12, 50, 56], files: ['../../tools/travel-kb/store.ts'] },
  37: { detail: '撤回同步来源/队列/城市模式/索引，旧版本回滚仍过滤撤回来源；静态前端需重建。', qa: [58], files: ['../../tools/travel-kb/store.ts'] },
  38: { detail: '原generatePlans检索与校验，保存保留release；原页面完成生成、保存、刷新和再次打开。', qa: [51, 53], files: ['results/browser-validation.json', '../../src/services/travel-kb/integration.test.ts'] },
  39: { detail: '开/关、空库、非法版本、旧Trip与局部编辑已测；同步本地检索无网络等待点，网络/模型超时在对应适配器验证。', qa: [52, 53, 54], files: ['results/feature-flag.md'] },
  40: { detail: '发现页未自动发帖；运行包没有Gooh正文、未明权限图片或fixture。', qa: [12, 56], files: ['integration/content-usage-policy.md'] },
  41: { detail: '60个QA编号均有测试；额外5项机制测试；40个自然语言+结构化评价输入为明确合成场景，独立真实金标准缺失单列。', qa: [57, 59], files: ['results/qa-results.json', '../../tools/travel-kb/tests/evaluation/scenarios.json'] },
  42: { detail: '实际本地导入→脱敏→字段核验→知识→发布链运行；重复/事务中断/新会话恢复已测。', qa: [20, 21, 22, 50, 60], files: ['results/pipeline-e2e.md'] },
  43: { detail: '注入文字、敏感字段、内网目标、未知POST及伪证据夹具通过；没有执行源文本。', qa: [3, 5, 9, 10, 11, 40], files: ['results/privacy.md'] },
  44: { status: 'BLOCKED', detail: '40组成对生成已运行；没有Gooh样本、官方当前事实或独立评分，分数/收益为null，未通过质量发布门。', qa: [59], files: ['results/ab-evaluation.md'] },
  45: { status: 'BLOCKED', detail: '200次4单元小索引延迟已测；没有相同10份真实Gooh样本的旧逐页基线，不报告提速倍数。', qa: [48], files: ['results/performance.md'] },
  46: { detail: 'update/resume检查哈希与持久撤回，新增/更新/撤回和进程恢复通过，未注册常驻任务。', qa: [20, 21, 58, 60], files: ['resume.md'] },
  47: { detail: '逐来源计数、产物扫描、受保护文件哈希与Git范围核对；未知总量null，Gooh仍0。', qa: [40, 56, 57], files: ['results/final-audit.json'] },
  48: { detail: '48项均按真实执行范围回填；交付代码、命令、数据/测试结果、六类状态与具体阻塞。', qa: [59, 60], files: ['results/tasks.json', 'results/final-report.md'] },
}

function md(path: string, text: string) { mkdirSync(dirname(join(docs, path)), { recursive: true }); writeFileSync(join(docs, path), text.trim() + '\n') }
const store = new KnowledgeStore(root)
try {
  const summary = report(store), metrics = summary.metrics
  const tests = JSON.parse(readFileSync(join(root, 'runs/latest/tests.json'), 'utf8'))
  const allTests = JSON.parse(readFileSync(join(root, 'runs/latest/full-tests.json'), 'utf8'))
  const assertions = tests.testResults.flatMap((r: { name: string; assertionResults: unknown[] }) => r.assertionResults.map((a: unknown) => ({ ...(a as object), file: r.name }))) as Array<{ fullName: string; status: string; file: string; duration: number }>
  const qa = Array.from({ length: 60 }, (_, i) => {
    const id = `QA-${String(i + 1).padStart(2, '0')}`, a = assertions.find(a => a.fullName.includes(`${id} `))
    return { id, status: a?.status === 'passed' ? 'PASS' : 'FAIL', fixture_scope: 'synthetic_fixture or existing authored-project-source; never live Gooh', assertion: a?.fullName, test_file: a?.file, duration_ms: a?.duration }
  })
  atomicJson(join(docs, 'results/qa-results.json'), qa)
  const catalog: Array<{ id: string; title: string }> = JSON.parse(readFileSync(join(docs, 'task-catalog.json'), 'utf8').replace(/^\uFEFF/, ''))
  const tasks = catalog.map(t => {
    const s = specs[Number(t.id.slice(3))]
    return { ...t, status: s.status ?? (s.qa.every(n => qa[n - 1].status === 'PASS') ? 'PASS' : 'FAIL'),
      original_problem: t.title, environment: 'D:/走走; Node24; local deterministic pipeline; Gooh live blocked',
      actual_result: s.detail, output_files: s.files, verification: s.qa.map(n => `QA-${String(n).padStart(2, '0')}`),
      evidence: ['results/qa-results.json', 'tools/travel-kb/runs/latest/tests.json'],
      scope: s.status === 'BLOCKED' ? 'External data/capability or evaluation baseline missing; independent local implementation continues' : 'Only the explicitly described local implementation and checked scope',
      release: store.currentRelease()?.release_id, unresolved: s.status === 'BLOCKED' ? s.detail : null,
      fallback: 'Existing local source / synthetic mechanism tests, kept separate from Gooh statistics', checkpoint: 'tools/travel-kb/private/state.sqlite',
      next_step: s.status === 'BLOCKED' ? 'Resume when a normal relevant input exists; do not fabricate data or ask again for already readable material' : 'Use checked command; do not repeat unchanged work' }
  })
  atomicJson(join(docs, 'results/tasks.json'), tasks)
  const source = metrics.by_source.find(s => s.source_id === 'zouzou-legacy-research')!
  const evaluation = JSON.parse(readFileSync(join(root, 'runs/latest/evaluation-summary.json'), 'utf8'))
  const perf = JSON.parse(readFileSync(join(root, 'runs/latest/metrics.json'), 'utf8'))
  const baseline = JSON.parse(readFileSync(join(docs, 'initial-baseline.json'), 'utf8').replace(/^\uFEFF/, ''))
  const protection = baseline.protected_hashes.map((item: { path: string; sha256: string }) => ({ path: item.path, unchanged: hash(readFileSync(item.path)).toLowerCase() === item.sha256.toLowerCase(), intentionally_modified: item.path.endsWith('planner.ts') }))
  const audit = { at: new Date().toISOString(), code_hash: codeHash(), tested_code_hash: store.checkpoint('verified_code_hash'), protected_files: protection,
    private_git_ignored: execFileSync('git', ['check-ignore', 'tools/travel-kb/private/state.sqlite'], { cwd: workspace, encoding: 'utf8' }).trim(),
    release_only_authored_rules: store.currentRelease()!.units.every(u => u.kind === 'rule' && u.source_id === 'zouzou-authored-rules'),
    gooh_live: metrics.gooh_live_guides, fixture_in_release: store.currentRelease()!.units.some(u => u.data_origin === 'synthetic_fixture'),
    dependency_manifest_unchanged: protection.filter((p: { path: string }) => /package.json|pnpm-lock/.test(p.path)).every((p: { unchanged: boolean }) => p.unchanged),
    commits_or_pushes: false, deployed: false, independent_factual_accuracy: null }
  atomicJson(join(docs, 'results/final-audit.json'), audit)
  atomicJson(join(docs, 'results/test-summary.json'), { at: new Date().toISOString(), task_tests: tests.numTotalTests, task_passed: tests.numPassedTests,
    full_tests: allTests.numTotalTests, full_passed: allTests.numPassedTests, full_test_files: allTests.testResults.length, qa_ids: qa.length, qa_passed: qa.filter(q => q.status === 'PASS').length })
  atomicJson(join(docs, 'results/coverage.json'), metrics)
  atomicJson(join(docs, 'results/evaluation-summary.json'), evaluation)
  atomicJson(join(docs, 'results/performance.json'), perf)
  md('results/tasks.md', `# 48项执行结果\n\n${tasks.filter(t => t.status === 'PASS').length} PASS，${tasks.filter(t => t.status === 'BLOCKED').length} BLOCKED。PASS 仅适用于逐项列出的实际范围。\n\n| ID | 任务 | 状态 | 实际结果 |\n|---|---|---|---|\n${tasks.map(t => `| ${t.id} | ${t.title} | ${t.status} | ${t.actual_result} |`).join('\n')}`)
  const assets = JSON.parse(readFileSync(join(root, 'runs/latest/asset-manifest.json'), 'utf8')) as Array<{ path: string; format: string }>
  md('gooh/local-assets.md', `# 本地资料盘点\n\n限定路径共 ${assets.length} 个文件。完整路径、大小、哈希和格式位于 tools/travel-kb/runs/latest/asset-manifest.json。研究报告和走走验收截图不计为Gooh攻略。\n\n${['json','md','txt','png'].map(f => `- ${f}: ${assets.filter(a => a.format === f).length}`).join('\n')}\n\n允许的附件目录只发现本任务书相关文件，未新增真实Gooh导出。`)
  md('gooh/page-map.md', '# Gooh 内容面\n\n全部内容面完成状态登记；BLOCKED 不表示产品没有此功能。旧首页导航观察仅为历史背景。\n\n| ID | 内容面 | 当前状态 | 证据 |\n|---|---|---|---|\n' + ['发现列表','城市探索','攻略详情','地点详情','餐饮','住宿','交通','预约营业','总览分享','复制计划','清单费用','AI样本','UGC元数据','媒体'].map((s,i)=>`| SUR-${String(i+1).padStart(2,'0')} | ${s} | BLOCKED | access-checks.json；无本轮可读详情字段 |`).join('\n'))
  md('gooh/coverage.md', `# Gooh 覆盖\n\n真实正文入口0；列表页0；详情0；完整0；部分0；唯一攻略0；POI0；城市0；total_available=null。停止原因 NO_OBSERVED_CONTENT_ENTRY。不能宣称 LIST_EXHAUSTED 或全库100%。\n\n其他来源独立：走走旧资料10条partial、9城市、44唯一POI；项目规则4条。通用分页测试不计任何真实采集。`)
  md('results/quality.md', `# 质量结果\n\n本地接受14条来源记录，Schema/业务证据校验通过；${summary.evidence_audit.key_fields}个非空字段与清洗源数据逐一相等（${summary.evidence_audit.matched}/${summary.evidence_audit.key_fields}）。这是程序一致性核对，不是独立人工金标准的98%准确率，也不证明现实事实。\n\n${tests.numPassedTests}/${tests.numTotalTests}个本任务测试通过，包含60个QA编号。名称歧义、未知费用、跨日、权限、事务中断、回滚及撤回均有用例。当前发布包仅4个项目规则，没有已验证Gooh事实。`)
  md('results/ab-evaluation.md', `# 成对评价\n\n${evaluation.generated_pairs}/40对生成成功。A为原本地确定性生成器关闭知识开关；B为同一输入、同一生成器开启知识开关。UUID随机，排程输入固定。每组自然语言、结构化条件、双方节点、错误与未知项保存于 tools/travel-kb/runs/latest/evaluation.jsonl。\n\n状态 INSUFFICIENT_EVIDENCE；中位提升=null，不劣比例=null，盲评=BLOCKED。新增未知条件提示会使问题数量增加，这不是质量变差或提升的数值证明。无Gooh样本、无独立质量评分，没有填写100分表中的主观分。\n\nEV-12独立算术断言：11:20+180+25最早14:45，13:45被硬规则拒绝。其他需要营业、库存、天气、真实路线的细分场景只运行合成生成回归，不宣称已核验。`)
  md('results/performance.md', `# 性能与费用\n\n${perf.cpu}；Node ${perf.node}；内存 ${perf.memory_bytes} bytes；运行包 ${perf.units} 个自编规则单元；${perf.queries}次查询；首次 ${perf.first_query_ms.toFixed(3)} ms，warm p95 ${perf.warm_p95_ms.toFixed(3)} ms。仅代表当前小型内存索引，未验证1000条攻略规模。\n\n模型调用0，API计费token0。相同10份Gooh资料的旧逐页流程基线不存在，因此耗时倍数、人工交互改善和字段准确率增益均为null，KB-45整体BLOCKED。`)
  md('results/privacy.md', '# 数据边界检查\n\nQA-03/05/09/10/11/40覆盖未登记域名、私密对象、未知POST、文本注入、内网地址、嵌套凭证与个人信息。额外测试拒绝伪造字段定位/值。源码不执行资料文本，外部模型默认不调用。\n\nRaw仅进入本工具private/state.sqlite；Git ignore实测命中。当前release仅项目自编规划规则，未复制第三方攻略全文或媒体。没有扫描用户凭证，没有共享原始HAR/截图。测试覆盖范围内未发现夹具敏感值泄漏；不声称绝对无风险。')
  md('results/visual-extraction.md', '# 视觉提取：BLOCKED\n\n已盘点已有截图，历史Gooh首页/走走验收图不能当作完整攻略。没有新Gooh图像正文可验证。导入器按内容/格式将视觉输入标为PENDING_VISUAL，并可按字节哈希去重；未执行OCR、视频关键帧提取或伪造识别精度。')
  md('results/deduplication.md', '# 去重与模式\n\n同内容重跑不增加来源版本；更新同来源ID保留旧Raw，新版本成为active。路线指纹包含城市ID、日期、主题、天数、Day分组、POI顺序、时刻与停留，实质变化不合并。\n\n现有10条走走研究路线形成10个candidate模式。复制同一模式的测试8条仍只计1个独立簇。没有真实Gooh支持簇或已审旅游模式。')
  md('results/content-gaps.md', `# 城市知识与缺口\n\n已有资料城市：${source.cities.join('、')}；10条路线均partial，44唯一POI。城市短单元、餐饮原说法、交通原说法和风险原说法在private/knowledge.json，有claim与JSON pointer。\n\n20维矩阵保留unknown；餐饮词不代表逐餐安排，交通方式不代表真实道路耗时，来源未提供住宿片区、已订酒店或房晚证据。KB-28/29保持BLOCKED。所有来源观察不作为当前事实，未用市中心坐标、0元或固定缓冲补齐。`)
  md('integration/knowledge-presentation-map.md', '# 对接位置\n\n原generatePlans→planningKnowledge→原多方案排程→attachKnowledge→原保存。release/provenance/gaps写入GeneratedPlan.knowledgeTrace，规划说明进入现有evidence，硬违规及知识缺口进入validation.issues；原保存Schema保持兼容。\n\nupdateGeneratedPlan重算知识规则并比较原Trip与完成/锁定节点；原工具仍读取同一Trip。研究G01—20只保留在后台资料，未新增前台目录或地图。当前知识仅通用规划依据，餐饮/住宿/当前事实增强仍依赖可核验来源。')
  md('integration/content-usage-policy.md', '# 复用与发布\n\n研究权限不等于公开发布。Gooh正文0条，旧走走资料runtime=unknown，全部拒绝进入新正式release。当前包仅项目自编规则，来源不是Gooh。没有自动调用发现发帖、邀请或分享接口。\n\n源撤回影响私有索引和构建投影；已有静态部署与远程缓存刷新未开展，默认生产开关关闭。')
  md('results/feature-flag.md', '# 开关与降级\n\nVITE_TRAVEL_KB=1仅在独立本地进程开启；省略/0回到原行为。单测验证开关关闭时排程与旧Trip可读；开启时真实generatePlans保留4条项目规则及release；空库/异常返回unavailable+gaps，不伪造来源。\n\n本地检索同步且不发HTTP，没有假装做超时请求。来源网络和模型调用的超时单独在适配器测试。浏览器原流程已完成，详见browser-validation.json。')
  md('results/pipeline-e2e.md', '# 流水线回归\n\nrun --mode auto已运行真实本地资料链：10条旧研究路线+4条项目规则→白名单脱敏→Schema与字段证据→9城/10候选模式→用途过滤→4条规则release→原生成和保存。\n\n重复run/update/resume无新增来源版本。QA-22通过独立Node子进程在SQLite未提交事务中exit(9)，恢复后保留已提交记录与旧游标；QA-60关闭并重开数据库后同内容重放仍零重复。QA-58验证撤回连带过滤与回滚后仍不能恢复撤回源。')
  md('results/blockers.md', '# 外部阻塞\n\n' + tasks.filter(t=>t.status==='BLOCKED').map(t=>`- ${t.id} ${t.title}：${t.actual_result}`).join('\n') + '\n\n本次可执行本地工作已继续完成；没有反复索要已有资料，没有空转重试或安排后台自动采集。')
  md('results/final-report.md', `# Gooh → 走走：本轮执行结果\n\n已实现并验证当前可执行的本地知识流水线与原生成链路接入；完整任务仍为 BLOCKED。48项任务中${tasks.filter(t=>t.status==='PASS').length}项在其声明范围内PASS、${tasks.filter(t=>t.status==='BLOCKED').length}项BLOCKED，详见tasks.json/tasks.md。\n\n| 类别 | 状态 | 实际范围 |\n|---|---|---|\n| 工程能力 | ${summary.states.engineering} | CLI、导入、清洗、Schema、证据、事务/恢复、规则、索引、release/撤回的本地实现；模型/视觉/Gooh实际能力见阻塞项 |\n| Gooh来源 | BLOCKED | 真实攻略0，未获得可重复正文入口 |\n| Gooh范围采集 | BLOCKED | 列表/详情0，总量unknown，不能报整库完成 |\n| 知识质量 | BLOCKED | 152个抽取字段一致不等于现实准确；40对无独立评分与Gooh语料 |\n| 走走接入 | ${summary.states.zouzou_integration} | 原generatePlans检索与校验、保存release、关闭开关兼容；真实浏览器流程通过 |\n| 总任务 | BLOCKED | 真实Gooh获取和基于它的质量提升仍缺证据 |\n\n已有走走资料10条，均partial；9个城市、44唯一POI、10个candidate模式。新编写规则R01—24可执行；正式运行包只包含4条自编规则依据，版本${store.currentRelease()?.release_id}。没有第三方城市事实通过发布门，没有Gooh样本被替代计数。\n\n本轮测试${tests.numPassedTests}/${tests.numTotalTests}通过，覆盖60个QA编号；项目全量${allTests.numPassedTests}/${allTests.numTotalTests}通过。TypeScript与Vite直接编译成功；pnpm包装命令被已有workerd安装脚本审批策略拦截，未修改策略或锁文件。浏览器完成真实表单、三方案、保存、刷新、重开。\n\n40组同模型本地A/B全部生成，质量结论INSUFFICIENT_EVIDENCE；不报告5分提升或75%不劣。200次4单元小索引warm p95=${perf.warm_p95_ms.toFixed(3)}ms，没有旧逐页基线，不能报告提速倍数。\n\n隐私与发布：原始副本在private SQLite，Git忽略已核对；来源用途、证据定位与原值逐项检查。来源撤回与旧版本回滚测试通过，静态前端需重建投影才得到撤回结果。生产开关默认关闭，未提交、推送、部署或发帖；没有批量模型付费调用。\n\n入口：node node_modules/tsx/dist/cli.mjs tools/travel-kb/cli.ts run --mode auto。后续继续使用resume；当前退出码10表示外部阻塞，不是工程异常。详见tools/travel-kb/README.md与../resume.md。\n\n仍需真实输入才能完成：Gooh客户端/正常数据流/攻略试采、有效视觉材料、已明确预算与外发范围的语义处理、完整餐宿与真实交通证据、Gooh独立质量评价和旧流程速度基线。恢复步骤已保存，没有会话结束后自动工作的承诺。`)
  console.log(JSON.stringify({ tasks: tasks.length, pass: tasks.filter(t=>t.status==='PASS').length, blocked: tasks.filter(t=>t.status==='BLOCKED').length, qa: qa.length, engineering: summary.states.engineering, final_report: join(docs, 'results/final-report.md') }, null, 2))
} finally { store.close() }
