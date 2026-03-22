import styles from '../orbit.module.css'

export default function SearchLoading() {
  return (
    <div className={styles.screen}>
      <div className={styles.shell}>
        <div className={styles.skeletonBlock} style={{ width: 120, height: 28, marginBottom: 16, borderRadius: 8 }} />
        <div className={styles.skeletonBlock} style={{ width: '100%', height: 44, marginBottom: 24, borderRadius: 8 }} />
        <div className={styles.feed}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${styles.post} ${styles.skeletonPost}`}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className={styles.skeletonBlock} style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)', borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className={styles.skeletonBlock} style={{ height: 14, width: '80%', marginBottom: 8 }} />
                  <div className={styles.skeletonBlock} style={{ height: 12, width: '60%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
