# Pinia Store Troubleshooting Guide for FreeKiosk WebView

## Problem
Pinia store not working in Nuxt 3 app when loaded in React Native WebView, but works fine in native Chrome.

## Root Causes
1. **localStorage/sessionStorage** might not be properly initialized in WebView context
2. **Cookies** may not persist correctly between page loads
3. **User Agent** differences can cause server-side rendering mismatches
4. **WebView data directory** not properly configured on Android

## Implemented Fixes

### 1. WebView Component Updates (`src/components/WebViewComponent.tsx`)

#### ✅ Added Chrome User Agent
```typescript
userAgent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
```
- Ensures Nuxt/Pinia receives consistent browser identification
- Prevents server-side rendering hydration mismatches

#### ✅ Enhanced Storage Debugging
```javascript
// Injected JavaScript now includes:
console.log('[FreeKiosk Debug] localStorage available:', typeof localStorage !== 'undefined');
console.log('[FreeKiosk Debug] sessionStorage available:', typeof sessionStorage !== 'undefined');
console.log('[FreeKiosk Debug] Cookie:', document.cookie ? 'enabled' : 'disabled');

// Storage test
try {
  localStorage.setItem('__test__', '1');
  localStorage.removeItem('__test__');
  console.log('[FreeKiosk Debug] localStorage: WORKING');
} catch(e) {
  console.error('[FreeKiosk Debug] localStorage: FAILED', e);
}
```

#### ✅ Additional WebView Props
```typescript
cacheMode="LOAD_DEFAULT"
setSupportMultipleWindows={false}
```

### 2. Android MainActivity Updates (`android/app/src/main/java/com/freekiosk/MainActivity.kt`)

#### ✅ WebView Storage Configuration
```kotlin
try {
  WebView.setWebContentsDebuggingEnabled(true)  // Enable Chrome DevTools
  val webView = WebView(applicationContext)
  val webSettings = webView.settings
  webSettings.domStorageEnabled = true  // Enable localStorage/sessionStorage
  webSettings.databaseEnabled = true     // Enable Web SQL Database
  webSettings.javaScriptEnabled = true   // Ensure JS is enabled
  android.util.Log.d("MainActivity", "WebView storage configured for Pinia/Nuxt")
} catch (e: Exception) {
  android.util.Log.e("MainActivity", "Error configuring WebView storage: ${e.message}")
}
```

## Testing & Debugging

### 1. Check Logs
After rebuilding, check Android logs for:
```bash
adb logcat | grep -E "(FreeKiosk|MainActivity|chromium)"
```

Look for:
- `[FreeKiosk Debug] localStorage: WORKING`
- `[FreeKiosk Debug] localStorage available: true`
- `WebView storage configured for Pinia/Nuxt`

### 2. Chrome DevTools Remote Debugging
1. Enable USB debugging on your Android device
2. Open Chrome on your computer: `chrome://inspect`
3. Find your WebView and click "Inspect"
4. In Console, check:
   ```javascript
   typeof localStorage
   typeof sessionStorage
   document.cookie
   localStorage.setItem('test', '123')
   localStorage.getItem('test')
   ```

### 3. Test Pinia Store Manually
In Chrome DevTools console connected to your WebView:
```javascript
// Check if Pinia is loaded
$nuxt.$pinia

// Check stores
$nuxt.$pinia._s

// Try to access your store (replace 'main' with your store name)
const store = useMainStore()
console.log(store.$state)

// Test reactivity
store.someValue = 'test'
```

## Rebuild Instructions

After these changes, you MUST rebuild the Android app:

```bash
cd android
./gradlew clean
cd ..
npm run android
```

Or faster:
```bash
npm run android -- --reset-cache
```

## Common Pinia Issues in WebView

### Issue 1: Store State Not Persisting
**Symptom**: Pinia state resets on every page reload

**Solutions**:
- Use `pinia-plugin-persistedstate` with localStorage
- Ensure `cacheEnabled={true}` in WebView (already set)
- Check cookies are working: `document.cookie` should return your session

### Issue 2: SSR Hydration Mismatch
**Symptom**: Console errors about hydration, store values wrong initially

**Solutions**:
- User Agent is now set to match Chrome
- Ensure your Nuxt app uses `ssr: true` or `ssr: false` consistently
- Check `nuxt.config.ts` for `compatibilityDate`

### Issue 3: Third-Party Cookies Blocked
**Symptom**: Store works on first domain but breaks on redirects

**Solutions**:
- `thirdPartyCookiesEnabled={true}` is already set
- Check `sharedCookiesEnabled={true}` is present
- Verify no `SameSite=Strict` cookies in your Nuxt app

### Issue 4: Storage Quota Exceeded
**Symptom**: `QuotaExceededError` in console

**Solutions**:
- Clear WebView cache: use CookieManager.clearAll() in settings
- Reduce data stored in Pinia
- Use IndexedDB instead of localStorage for large data

## Nuxt 3 Pinia Configuration

Ensure your `nuxt.config.ts` has:

```typescript
export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],
  
  pinia: {
    autoImports: ['defineStore', 'acceptHMRUpdate'],
  },
  
  // Optional: Add persistence
  // modules: ['@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt'],
})
```

## Example Pinia Store with Persistence

```typescript
// stores/main.ts
import { defineStore } from 'pinia'

export const useMainStore = defineStore('main', {
  state: () => ({
    count: 0,
    user: null,
  }),
  
  // Optional: Persist to localStorage
  persist: {
    storage: persistedState.localStorage,
  },
  
  actions: {
    increment() {
      this.count++
    }
  }
})
```

## Verify Installation

Run this command to ensure all dependencies are installed:
```bash
npm install
```

## If Still Not Working

### 1. Add More Debug Logging to Your Nuxt App

Create a plugin `plugins/storage-debug.client.ts`:
```typescript
export default defineNuxtPlugin(() => {
  console.log('[Nuxt] Storage check:', {
    localStorage: typeof localStorage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined',
    cookies: document.cookie !== '',
    userAgent: navigator.userAgent,
  })
})
```

### 2. Test with Simple Store First

Create a minimal test store:
```typescript
// stores/test.ts
export const useTestStore = defineStore('test', {
  state: () => ({ value: 'initial' }),
  actions: {
    setValue(v: string) { this.value = v }
  }
})
```

Use it in a page:
```vue
<script setup>
const test = useTestStore()
test.setValue('works!')
</script>
<template>
  <div>{{ test.value }}</div>
</template>
```

### 3. Check Network Tab in Chrome DevTools
- Look for failed API calls
- Check if cookies are being sent with requests
- Verify CORS headers if calling external APIs

### 4. Disable Incognito Mode Temporarily
If Pinia relies on cookies, test with:
```typescript
incognito={false}  // Already set, but verify it's working
```

## Additional Resources

- [Pinia Documentation](https://pinia.vuejs.org/)
- [Nuxt 3 Pinia Module](https://pinia.vuejs.org/ssr/nuxt.html)
- [React Native WebView Docs](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md)
- [Chrome DevTools Remote Debugging](https://developer.chrome.com/docs/devtools/remote-debugging/)

## Summary of Changes

✅ **WebView Component**:
- Added Chrome user agent
- Added storage debugging
- Added `cacheMode` and `setSupportMultipleWindows` props

✅ **Android MainActivity**:
- Enabled WebView debugging
- Configured domStorageEnabled
- Configured databaseEnabled
- Added logging

**Next Steps**: Rebuild the app and test with Chrome DevTools remote debugging to see the storage logs.
