import { clearNeteaseCookie, getNeteaseCookie, setNeteaseCookie } from './ipc'

let cookiePromise: Promise<string | null> | null = null

export const getNeteaseCookieValue = async() => {
  return (cookiePromise ??= getNeteaseCookie())
}

export const saveNeteaseCookieValue = async(value: string) => {
  await setNeteaseCookie(value)
  cookiePromise = getNeteaseCookie()
}

export const clearNeteaseCookieValue = async() => {
  await clearNeteaseCookie()
  cookiePromise = Promise.resolve(null)
}
