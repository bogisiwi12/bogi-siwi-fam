/* global firebase, clients, importScripts */
importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyAZH071-ONLU6wrB3yCfAmi_VpLXwCFngQ',
  authDomain: 'bogisiwifam.firebaseapp.com',
  projectId: 'bogisiwifam',
  storageBucket: 'bogisiwifam.firebasestorage.app',
  messagingSenderId: '216714637691',
  appId: '1:216714637691:web:bfeaf83768c72677be0dde'
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {}
  const title = data.title || 'Finance update'
  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || data.notificationId || undefined,
    data: {
      link: data.link || '/finance',
      notificationId: data.notificationId || ''
    }
  }

  return self.registration.showNotification(title, options)
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/finance'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client) client.navigate(link)
            return client.focus()
          }
        }
        if (clients.openWindow) return clients.openWindow(link)
        return undefined
      })
  )
})
