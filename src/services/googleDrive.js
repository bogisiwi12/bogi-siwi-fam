const CLIENT_ID = import.meta.env.VITE_CLIENT_ID
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_MEMBER_PICTURE_FOLDER_ID

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const MAX_DIMENSION = 1024

let gisPromise = null
let tokenClient = null
let pendingToken = null
let cachedToken = ''
let tokenExpiresAt = 0

export function isDriveConfigured() {
  return Boolean(CLIENT_ID && FOLDER_ID)
}

function loadGis() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in is not available in this environment.'))
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisPromise) return gisPromise

  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google sign-in.')),
        { once: true }
      )
      return
    }

    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      gisPromise = null
      reject(new Error('Failed to load Google sign-in.'))
    }
    document.head.appendChild(script)
  })

  return gisPromise
}

function describeGisError(error) {
  switch (error?.type) {
    case 'popup_closed':
      return 'Google sign-in was cancelled.'
    case 'popup_failed_to_open':
      return 'Google sign-in popup was blocked. Allow popups and try again.'
    case 'access_denied':
      return 'Google Drive access was denied.'
    default:
      return error?.message || 'Google sign-in failed.'
  }
}

function ensureTokenClient() {
  if (tokenClient) return tokenClient
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (response) => {
      const request = pendingToken
      pendingToken = null
      if (!request) return
      if (response.error) {
        request.reject(new Error(response.error_description || response.error))
        return
      }
      cachedToken = response.access_token
      tokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000
      request.resolve(cachedToken)
    },
    error_callback: (error) => {
      const request = pendingToken
      pendingToken = null
      if (!request) return
      request.reject(new Error(describeGisError(error)))
    }
  })
  return tokenClient
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken

  await loadGis()
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google sign-in could not be initialized.')
  }

  const client = ensureTokenClient()
  return new Promise((resolve, reject) => {
    if (pendingToken) pendingToken.reject(new Error('A Google sign-in is already in progress.'))
    pendingToken = { resolve, reject }
    try {
      client.requestAccessToken()
    } catch (err) {
      pendingToken = null
      reject(err)
    }
  })
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read the selected image.'))
    }
    image.src = url
  })
}

async function prepareImage(file) {
  const image = await loadImage(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Could not process the selected image.')
  return blob
}

function slug(value) {
  return (
    String(value || 'member')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'member'
  )
}

async function readError(response) {
  try {
    const body = await response.json()
    return body?.error?.message || `Google Drive request failed (${response.status}).`
  } catch {
    return `Google Drive request failed (${response.status}).`
  }
}

async function deleteFile(fileId, token) {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
  } catch {
    // Best-effort cleanup only.
  }
}

/**
 * Uploads an image to the configured Google Drive folder and makes it
 * publicly readable so it can be used as a member profile picture.
 */
export async function uploadMemberPicture(file, memberName = 'member') {
  if (!isDriveConfigured()) {
    throw new Error(
      'Google Drive uploads are not configured. Set VITE_CLIENT_ID and VITE_GOOGLE_DRIVE_MEMBER_PICTURE_FOLDER_ID in .env.'
    )
  }
  if (!file) throw new Error('No image selected.')
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Image is too large (maximum 20 MB).')

  const token = await getAccessToken()
  const image = await prepareImage(file)

  const metadata = {
    name: `${slug(memberName)}-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    parents: [FOLDER_ID]
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', image)

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  )

  if (!uploadResponse.ok) throw new Error(await readError(uploadResponse))
  const uploaded = await uploadResponse.json()

  const permissionResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}/permissions?fields=id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    }
  )

  if (!permissionResponse.ok) {
    const message = await readError(permissionResponse)
    await deleteFile(uploaded.id, token)
    throw new Error(`Could not share the uploaded picture: ${message}`)
  }

  return {
    id: uploaded.id,
    name: uploaded.name,
    url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}?alt=media&key=${encodeURIComponent(API_KEY || '')}`
  }
}
