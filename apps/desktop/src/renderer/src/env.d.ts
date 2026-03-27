import type { AppBridge } from '../../preload/index'

declare global {
  interface Window {
    appBridge: AppBridge
  }
}
