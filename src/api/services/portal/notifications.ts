// ============================================================
// HealSync HMS — Patient Portal: notifications
// ============================================================

import { ENDPOINTS, withParams } from '../../endpoints'
import { http, USE_MOCK_API } from '../../client'
import { mockDelay } from '../../mock'
import { mockNotifications } from '../../mockPortal'
import type { PortalNotification } from '../../../types/portal'

let notifications: PortalNotification[] = [...mockNotifications]

export async function listNotifications(): Promise<PortalNotification[]> {
  if (USE_MOCK_API) {
    await mockDelay(350)
    return [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return http.get<PortalNotification[]>(ENDPOINTS.PORTAL_NOTIFICATIONS)
}

export async function markNotificationRead(id: string): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(150)
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    return
  }
  await http.post(withParams(ENDPOINTS.PORTAL_NOTIFICATION_READ, { id }))
}

export async function markAllNotificationsRead(): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(200)
    notifications = notifications.map((n) => ({ ...n, read: true }))
    return
  }
  await http.post(ENDPOINTS.PORTAL_NOTIFICATIONS_READ_ALL)
}

export async function getUnreadCount(): Promise<number> {
  if (USE_MOCK_API) {
    await mockDelay(120)
    return notifications.filter((n) => !n.read).length
  }
  const all = await http.get<PortalNotification[]>(ENDPOINTS.PORTAL_NOTIFICATIONS)
  return all.filter((n) => !n.read).length
}
