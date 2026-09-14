/** Matches the initial HTML and the intro's first pose while route code loads. */
export function LaunchPlaceholder() {
  return <div className="app-boot" aria-busy="true" aria-label="准备走走">
    <div className="app-boot__center"><div className="app-boot__window"><div className="app-boot__bot"><img src="/assets/brand/zouzou-boot.svg" alt="" width="180" height="180" /></div></div></div>
  </div>
}
