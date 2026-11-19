// Realtime carries a change signal. Values are always read from the authenticated API.
export function watchDashboard(api, refresh, state) {
  let socket, heartbeat, lease, retry, batch, joinDeadline;
  let stopped = false, generation = 0;
  function disconnect() {
    generation++;
    clearInterval(heartbeat);
    clearInterval(lease);
    clearTimeout(retry);
    clearTimeout(batch);
    clearTimeout(joinDeadline);
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      socket = null;
    }
  }
  function reconnect() {
    disconnect();
    if (!stopped && !document.hidden) {
      state(false);
      retry = setTimeout(connect, 25000);
    }
  }
  async function connect() {
    if (stopped || document.hidden) return;
    disconnect();
    const current = generation;
    try {
      const config = await api('live');
      if (current !== generation || !config.enabled) return;
      const endpoint = new URL('/realtime/v1/websocket', config.url);
      endpoint.protocol = 'wss:';
      endpoint.searchParams.set('apikey', config.key);
      endpoint.searchParams.set('vsn', '1.0.0');
      const ws = socket = new WebSocket(endpoint);
      const topic = 'realtime:' + config.topic;
      let sequence = 0, heartbeatRef = null, joinRef;
      const send = (channel, event, payload) => {
        const ref = String(++sequence);
        ws.send(JSON.stringify({topic:channel, event, payload, ref}));
        return ref;
      };
      joinDeadline = setTimeout(reconnect, 10000);
      ws.onopen = () => {
        const payload = {config:{broadcast:{ack:false, self:false}, presence:{enabled:false, key:''}, postgres_changes:[], private:true}};
        if (config.key.startsWith('eyJ')) payload.access_token = config.key;
        joinRef = send(topic, 'phx_join', payload);
      };
      ws.onmessage = event => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.event === 'phx_reply' && message.topic === 'phoenix' && message.ref === heartbeatRef) heartbeatRef = null;
        if (message.topic !== topic) return;
        if (message.event === 'phx_reply' && message.ref === joinRef) {
          if (message.payload?.status !== 'ok') { reconnect(); return; }
          clearTimeout(joinDeadline);
          state(true);
          refresh();
        } else if (message.event === 'broadcast' && message.payload?.event === 'report_changed') {
          // A sustained stream of writes still produces a refresh at least once per batch.
          if (!batch) batch = setTimeout(() => { batch = null; refresh(); }, 350);
        } else if (['phx_error','phx_close'].includes(message.event)) reconnect();
      };
      batch = null;
      ws.onerror = ws.onclose = reconnect;
      heartbeat = setInterval(() => {
        if (heartbeatRef !== null) { reconnect(); return; }
        if (ws.readyState === WebSocket.OPEN) heartbeatRef = send('phoenix', 'heartbeat', {});
      }, 25000);
      lease = setInterval(async () => {
        try {
          const renewed = await api('live');
          if (current === generation && (!renewed.enabled || renewed.topic !== config.topic)) reconnect();
        } catch { if (current === generation) reconnect(); }
      }, 75000);
    } catch {
      if (current === generation) reconnect();
    }
  }
  function visible() {
    if (document.hidden) { disconnect(); state(false); }
    else { refresh(); connect(); }
  }
  document.addEventListener('visibilitychange', visible);
  connect();
  return () => {
    stopped = true;
    disconnect();
    document.removeEventListener('visibilitychange', visible);
  };
}
