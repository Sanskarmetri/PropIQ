const TOKEN_STORAGE_KEY = 'propiq.auth.token';

const getStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getStoredToken = () => {
  try {
    return getStorage()?.getItem(TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
};

export const storeToken = (token) => {
  try {
    getStorage()?.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage can be unavailable in private browsing modes; the session then stays in memory only.
  }
};

export const clearStoredToken = () => {
  try {
    getStorage()?.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the in-memory auth state is cleared by the caller.
  }
};
