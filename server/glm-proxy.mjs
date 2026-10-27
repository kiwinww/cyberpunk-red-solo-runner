import { loadEnv } from 'vite';

// Development-only proxy. Deploy behind authentication and a rate limiter if made public.
export function glmProxyPlugin() {
  let apiKey = '';
  const officialUpstream = 'https://open.bigmodel.cn/api/paas/v4';
  let upstream = officialUpstream;
  let model = 'glm-4.7-flash';
  let active=false;
  let cooldownUntil=0;
  const middleware = async (req, res, next) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname !== '/api/ai/chat/completions' && pathname !== '/api/ai/status') return next();
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    if (pathname === '/api/ai/status') {
      if (req.method !== 'GET') return send(405, { error: { message: '仅支持 GET' } });
      return send(200, { service: 'glm-local-proxy', configured: Boolean(apiKey), model, thinking: /^glm-4\.7(?:-|$)/.test(model) ? 'disabled' : 'model-default', requestTimeoutMs: 55000, probeTimeoutMs: 45000 });
    }
    if (req.method !== 'POST') return send(405, { error: { message: '仅支持 POST' } });
    if (!apiKey) return send(503, { error: { message: '服务器未配置有效的 ZHIPU_API_KEY，请检查 .env.local 并重启 Vite。' } });
    if(active || cooldownUntil>Date.now()) {
      res.setHeader('Retry-After',String(Math.max(2,Math.ceil((cooldownUntil-Date.now())/1000))));
      return send(429,{error:{code:active?'local-busy':'local-cooldown',message:active?'已有主持请求进行中，请勿重复提交。':'服务商限流后的等待时间尚未结束，可切换离线继续。'}});
    }
    active=true;
    const controller=new AbortController();
    let disconnected=false;
    let timer;
    const cancel=()=>{if(!res.writableEnded){disconnected=true;controller.abort();}};
    res.on?.('close',cancel);
    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk.toString();
        if (raw.length > 500_000) return send(413, { error: { message: '请求内容过长' } });
      }
      const payload = JSON.parse(raw);
      if (!Array.isArray(payload.messages) || !payload.messages.length) return send(400, { error: { message: 'messages 参数无效' } });
      const probe = payload.purpose === 'connection-test';
      const streaming = payload.stream === true && !probe;
      timer=setTimeout(()=>controller.abort(),probe?45000:55000);
      // Avoid user supplied arbitrary upstream or stream mode. Model is configured on server.
      const response = await fetch(`${upstream}/chat/completions`, {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: payload.messages,
          temperature: payload.temperature ?? 0.7,
          stream: streaming,
          max_tokens: probe ? 64 : 1800,
          ...(/^glm-4\.7(?:-|$)/.test(model) ? { thinking: { type: 'disabled' } } : {}),
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        if(response.status===429){
          const retry=response.headers?.get('retry-after');
          const seconds=retry && /^\d+$/.test(retry)?Number(retry):retry?Math.ceil((Date.parse(retry)-Date.now())/1000):30;
          const delay=Math.min(300,Math.max(30,Number.isFinite(seconds)?seconds:30));
          cooldownUntil=Date.now()+delay*1000;
          res.setHeader('Retry-After',String(delay));
        }
        let detail;
        try { detail = JSON.parse(text).error; } catch { /* Do not expose non-JSON upstream responses. */ }
        return send(response.status, { error: {
          code: detail?.code == null ? String(response.status) : String(detail.code).split(apiKey).join('[redacted]').slice(0, 80),
          message: typeof detail?.message === 'string' ? detail.message.split(apiKey).join('[redacted]').slice(0, 500) : `智谱服务返回 HTTP ${response.status}`,
        } });
      }
      res.statusCode = response.status;
      res.setHeader('Cache-Control', 'no-store');
      if (streaming && response.body && response.headers?.get('content-type')?.includes('text/event-stream')) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('X-Accel-Buffering', 'no');
        let sent = 0;
        for await (const chunk of response.body) {
          if (controller.signal.aborted || disconnected) break;
          sent += chunk.byteLength;
          if (sent > 1_000_000) { controller.abort(); break; }
          res.write(chunk);
        }
        if (!disconnected) res.end();
      } else {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        // Some providers ignore streaming; let the client accept their JSON fallback.
        res.end((await response.text()).slice(0, 600_000));
      }
    } catch (error) {
      if(disconnected) return;
      if (res.headersSent) { res.end(); return; }
      const timeout = typeof error?.name === 'string' && /Timeout|Abort/.test(error.name);
      send(timeout ? 504 : 502, { error: { message: timeout ? '智谱响应超时，行动已保存，可稍后重试。' : '本地代理无法连接智谱，请检查服务器网络。' } });
    } finally {
      active=false;
      clearTimeout(timer);
      res.off?.('close',cancel);
    }
  };
  const register = server => { server.middlewares.use(middleware); };
  return {
    name: 'glm-local-proxy',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '');
      const candidate = String(env.ZHIPU_API_KEY || process.env.ZHIPU_API_KEY || '').trim();
      apiKey = candidate && candidate !== 'replace-with-your-new-key' ? candidate : '';
      // Only the official upstream is allowed; never route player context to arbitrary origins.
      if (env.ZHIPU_API_BASE && env.ZHIPU_API_BASE.replace(/\/$/, '') !== officialUpstream) {
        config.logger.warn('[GLM] 忽略非官方 API Base，请检查 .env.local 中的 ZHIPU_API_BASE。');
      }
      upstream = officialUpstream;
      // Model can be configured on the server only, not overridden by browser requests.
      if (env.ZHIPU_MODEL && /^glm-[a-zA-Z0-9.-]+$/.test(env.ZHIPU_MODEL)) model = env.ZHIPU_MODEL;
    },
    configureServer: register,
    configurePreviewServer: register,
  };
}
