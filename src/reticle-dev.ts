import { registerCapabilities } from '@reticlehq/react'

if (import.meta.env.DEV) {
  registerCapabilities({
    testids: [
      'login-email',
      'login-password',
      'login-remember',
      'login-submit',
      'nav-dashboard',
      'nav-patients',
      'nav-doctors',
      'nav-appointments',
      'nav-departments',
      'nav-pharmacy',
      'nav-billing',
      'nav-staff',
      'nav-reports',
      'nav-settings',
      'logout-btn',
    ],
    signals: ['auth:login', 'auth:logout', 'auth:register'],
    stores: ['auth'],
  })
}
