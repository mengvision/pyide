import { useEnvStore } from '../../stores/envStore';
import styles from './UvWarningBanner.module.css';

const UV_INSTALL_URL = 'https://docs.astral.sh/uv/';

export function UvWarningBanner() {
  const uvInstalled = useEnvStore((s) => s.uvInstalled);
  const uvWarningDismissed = useEnvStore((s) => s.uvWarningDismissed);
  const setUvWarningDismissed = useEnvStore((s) => s.setUvWarningDismissed);

  if (uvInstalled || uvWarningDismissed) {
    return null;
  }

  function handleInstallClick() {
    // Open in the system browser via an anchor click (works in Tauri WebView)
    window.open(UV_INSTALL_URL, '_blank', 'noopener');
  }

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.icon}>⚠</span>
      <span className={styles.message}>
        <strong>uv</strong> is not installed. Environment management is disabled.
      </span>
      <button className={styles.installBtn} onClick={handleInstallClick}>
        Install uv
      </button>
      <button
        className={styles.dismissBtn}
        onClick={() => setUvWarningDismissed(true)}
        aria-label="Dismiss"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
