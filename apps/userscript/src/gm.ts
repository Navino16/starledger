export type GmRequestOptions = {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  data?: string;
  timeout?: number;
};

export type GmResponse = { status: number; body: string };

export interface Gm {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  request(opts: GmRequestOptions): Promise<GmResponse>;
  addStyle(css: string): HTMLStyleElement;
  menu(label: string, fn: () => void): void;
}

export const realGm: Gm = {
  get: (key, fallback) => GM_getValue(key, fallback),
  set: (key, value) => GM_setValue(key, value as Tampermonkey.StorageValue),
  request: (opts) =>
    new Promise((resolve, reject) => {
      //! The engine enforces `timeout`; no timer of ours (AGENTS.md §1.2/§1.3)
      GM_xmlhttpRequest({
        method: opts.method,
        url: opts.url,
        headers: opts.headers,
        data: opts.data,
        timeout: opts.timeout,
        onload: (res) => resolve({ status: res.status, body: res.responseText }),
        onerror: () => reject(new Error('network error')),
        ontimeout: () => reject(new Error('timeout')),
        onabort: () => reject(new Error('aborted')),
      });
    }),
  addStyle: (css) => GM_addStyle(css),
  menu: (label, fn) => {
    GM_registerMenuCommand(label, fn);
  },
};

export type MemoryGm = Gm & {
  store: Map<string, unknown>;
  requests: GmRequestOptions[];
  menus: { label: string; fn: () => void }[];
  respondWith(handler: (opts: GmRequestOptions) => GmResponse | Promise<GmResponse>): void;
};

export function memoryGm(): MemoryGm {
  const store = new Map<string, unknown>();
  const requests: GmRequestOptions[] = [];
  const menus: { label: string; fn: () => void }[] = [];
  let handler: (opts: GmRequestOptions) => GmResponse | Promise<GmResponse> = () => ({
    status: 200,
    body: '',
  });
  return {
    store,
    requests,
    menus,
    respondWith: (h) => {
      handler = h;
    },
    get: <T>(key: string, fallback: T): T => (store.has(key) ? (store.get(key) as T) : fallback),
    set: (key, value) => {
      store.set(key, value);
    },
    request: async (opts) => {
      requests.push(opts);
      return handler(opts);
    },
    addStyle: (css) => {
      const el = document.createElement('style');
      el.textContent = css;
      document.head.append(el);
      return el;
    },
    menu: (label, fn) => {
      menus.push({ label, fn });
    },
  };
}
