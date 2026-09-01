import { AppShell } from '../components/AppShell'
import { ZouNavigationBar } from '../components/ui'
import { acquiredJourneyImages } from '../demo-data/acquired-journey-images'
import { buildShanghaiImageBatch } from '../services/journey-images/shanghai-batch'

const labels = { travel: '旅行', weekend: '周末', date: '约会', dining: '聚餐' } as const

/** Development-only visual review of the first 20 Shanghai acquisition entries. */
export const JourneyImageReviewPage = () => {
  const batch = buildShanghaiImageBatch()
  const groups = (Object.keys(labels) as Array<keyof typeof labels>).map((category) => [category, batch.filter((entry) => entry.batchCategory === category)] as const)
  const readyCount = batch.filter((entry) => acquiredJourneyImages.some((image) => image.journeyId === entry.id && image.selected)).length
  return <AppShell>
    <ZouNavigationBar title="Journey Image Review" />
    <main className="page-content" style={{ paddingBottom: 48 }}>
      <p style={{ marginBottom: 20 }}>上海首批 20 条 · 已选封面 {readyCount}/20 · 图片来自百度公开图片结果，检测后保存在本地</p>
      {groups.map(([category, entries]) => <section key={category} style={{ marginBottom: 28 }}>
        <h2 style={{ marginBottom: 12 }}>{labels[category]} · {entries.length}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          {entries.map((entry) => {
            const images = acquiredJourneyImages.filter((image) => image.journeyId === entry.id).sort((a, b) => Number(b.selected) - Number(a.selected) || (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
            const cover = images[0]
            return <article key={entry.id} style={{ minWidth: 0, border: '1px solid rgba(34, 34, 34, .08)', borderRadius: 16, padding: 10, background: 'rgba(255,255,255,.7)' }}>
              {cover ? <img src={cover.cachedUrl ?? cover.localPath} alt={entry.title} width={520} height={300} style={{ display: 'block', width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: 12 }} /> : <div style={{ height: 180, borderRadius: 12, background: '#eee', display: 'grid', placeItems: 'center' }}>未获取到本地图片</div>}
              <strong style={{ display: 'block', marginTop: 9, fontSize: 14 }}>{entry.title}</strong>
              <small style={{ display: 'block', marginTop: 3, opacity: .7 }}>{labels[category]} · {cover?.source ?? '未完成'} · {images.length} 张已下载</small>
              {images.length > 1 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginTop: 8 }}>{images.slice(1, 5).map((image) => <img key={image.id} src={image.cachedUrl ?? image.localPath} alt={`${entry.title} candidate`} width={120} height={72} style={{ width: '100%', aspectRatio: '5 / 3', objectFit: 'cover', borderRadius: 6 }} />)}</div>}
            </article>
          })}
        </div>
      </section>)}
    </main>
  </AppShell>
}
