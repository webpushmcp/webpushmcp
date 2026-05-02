// Helper to convert base64 to Uint8Array for Push API
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const elements = {
  status: document.getElementById('subscription-status')!,
  statusDot: document.querySelector('#subscription-status span')!,
  statusText: document.querySelector('#subscription-status span:last-child')!,
  subscribeBtn: document.getElementById('subscribe-btn')! as HTMLButtonElement,
  clientIdCard: document.getElementById('client-id-card')!,
  clientIdDisplay: document.getElementById('client-id-display')!,
  mcpUrlDisplay: document.getElementById('mcp-url-display')!,
  copyIdBtn: document.getElementById('copy-id-btn')!,
  copyMcpBtn: document.getElementById('copy-mcp-btn')!,
  testPushBtn: document.getElementById('test-push-btn')! as HTMLButtonElement,
  unsubscribeBtn: document.getElementById('unsubscribe-btn')! as HTMLButtonElement,
  configLocked: document.getElementById('config-locked')!,
  configUnlocked: document.getElementById('config-unlocked')!,
};

function updateStatus(status: 'idle' | 'subscribed' | 'error' | 'loading', message: string) {
  elements.statusText.textContent = message;
  elements.statusDot.className = 'w-2 h-2 rounded-full ' + ({
    idle: 'bg-slate-600',
    subscribed: 'bg-emerald-500',
    error: 'bg-red-500',
    loading: 'bg-indigo-500 animate-pulse'
  }[status]);
  
  if (status === 'subscribed') {
    elements.subscribeBtn.classList.add('hidden');
    elements.clientIdCard.classList.remove('hidden');
    elements.configLocked.classList.add('hidden');
    elements.configUnlocked.classList.remove('hidden');
  } else {
    elements.subscribeBtn.classList.remove('hidden');
    elements.clientIdCard.classList.add('hidden');
    elements.configLocked.classList.remove('hidden');
    elements.configUnlocked.classList.add('hidden');
  }
}

async function init() {
  const mcpUrl = window.location.origin + '/mcp';
  elements.mcpUrlDisplay.textContent = mcpUrl;
  
  document.querySelectorAll('.mcp-url-placeholder').forEach(el => {
    el.textContent = mcpUrl;
  });

  // Show locked config by default
  elements.configLocked.classList.remove('hidden');
  
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    updateStatus('error', 'Push notifications not supported in this browser.');
    elements.subscribeBtn.disabled = true;
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    const subscription = await registration.pushManager.getSubscription();
    
    const savedClientId = localStorage.getItem('push_mcp_clientId');
    
    if (subscription && savedClientId) {
      elements.clientIdDisplay.textContent = savedClientId;
      const personalizedUrl = window.location.origin + '/mcp/' + savedClientId;
      elements.mcpUrlDisplay.textContent = personalizedUrl;
      document.querySelectorAll('.mcp-url-placeholder').forEach(el => { el.textContent = personalizedUrl; });
      document.querySelectorAll('.client-id-placeholder').forEach(el => { el.textContent = savedClientId; });
      updateStatus('subscribed', 'Notifications enabled');
    } else {
      updateStatus('idle', 'Not registered');
    }
  } catch (err) {
    console.error('Service worker registration failed:', err);
    updateStatus('error', 'Failed to initialize service worker');
  }
}

async function subscribe() {
  updateStatus('loading', 'Subscribing...');
  
  try {
    const res = await fetch('/api/vapid-public-key');
    const vapidPublicKey = await res.text();
    
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    
    const subResponse = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON())
    });
    
    const { clientId } = await subResponse.json() as { clientId: string };
    localStorage.setItem('push_mcp_clientId', clientId);
    elements.clientIdDisplay.textContent = clientId;
    const personalizedUrl = window.location.origin + '/mcp/' + clientId;
    elements.mcpUrlDisplay.textContent = personalizedUrl;
    document.querySelectorAll('.mcp-url-placeholder').forEach(el => { el.textContent = personalizedUrl; });
    document.querySelectorAll('.client-id-placeholder').forEach(el => { el.textContent = clientId; });
    
    updateStatus('subscribed', 'Successfully registered!');
  } catch (err) {
    console.error('Subscription failed:', err);
    updateStatus('error', 'Subscription failed. Check console.');
  }
}

async function unsubscribe() {
  if (!confirm('Are you sure you want to unsubscribe? You will stop receiving notifications.')) return;
  
  const clientId = localStorage.getItem('push_mcp_clientId');
  if (clientId) {
    await fetch(`/api/subscription/${clientId}`, { method: 'DELETE' });
  }
  
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
  
  localStorage.removeItem('push_mcp_clientId');
  updateStatus('idle', 'Unsubscribed');
}

async function sendTestPush() {
  const clientId = localStorage.getItem('push_mcp_clientId');
  if (!clientId) return;
  
  elements.testPushBtn.disabled = true;
  const originalText = elements.testPushBtn.textContent;
  elements.testPushBtn.textContent = 'Sending...';
  
  try {
    // We'll use the MCP endpoint or a simple API for test push.
    // Since we're in the browser, it's easier to hit the MCP endpoint directly with a test call.
    await fetch('/mcp', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test',
        method: 'tools/call',
        params: {
          name: 'send_notification',
          arguments: {
            clientId,
            title: 'Test Notification 🔔',
            body: 'It works! Your AI agents can now reach you.',
            url: window.location.origin
          }
        }
      })
    });
    
    elements.testPushBtn.textContent = 'Sent!';
    setTimeout(() => {
      elements.testPushBtn.textContent = originalText;
      elements.testPushBtn.disabled = false;
    }, 2000);
  } catch (err) {
    console.error('Test push failed:', err);
    elements.testPushBtn.textContent = 'Failed';
    setTimeout(() => {
      elements.testPushBtn.textContent = originalText;
      elements.testPushBtn.disabled = false;
    }, 2000);
  }
}

function copy(text: string, btn: HTMLElement) {
  navigator.clipboard.writeText(text);
  const original = btn.innerHTML;
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>';
  setTimeout(() => btn.innerHTML = original, 2000);
}

elements.subscribeBtn.addEventListener('click', subscribe);
elements.unsubscribeBtn.addEventListener('click', unsubscribe);
elements.testPushBtn.addEventListener('click', sendTestPush);
elements.copyIdBtn.addEventListener('click', () => copy(elements.clientIdDisplay.textContent!, elements.copyIdBtn));
elements.copyMcpBtn.addEventListener('click', () => copy(elements.mcpUrlDisplay.textContent!, elements.copyMcpBtn));

init();
