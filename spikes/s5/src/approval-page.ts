const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function approvalPage(id: string, passkey: boolean) {
  const safe = esc(id)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="manifest" href="/manifest.webmanifest"><title>approval ${safe}</title>
<style>body{font:16px system-ui;max-width:32rem;margin:1rem auto;padding:0 1rem}button{font:inherit;padding:.8rem;margin:.3rem 0;width:100%}
.badge{background:#fde7e9;border-radius:99px;padding:.1rem .6rem;font-size:.85rem}pre{background:#f3f3f3;padding:.5rem;white-space:pre-wrap}</style></head><body>
<h1>Approval ${safe}</h1>
${passkey ? '<p><span class="badge">needs passkey</span></p>' : ''}
<p><strong>Device:</strong> laptop-1</p>
<p><strong>Step:</strong> run the deploy script</p>
<pre>plan:
1. npm test
2. npm run build
3. npm run deploy</pre>
<button data-d="approve">Approve</button>
<button data-d="approve_rest">Approve the rest of this run</button>
<button data-d="deny">Deny</button>
<p id="result" role="status"></p>
<script>
const id=${JSON.stringify(id)},needsPasskey=${passkey},out=document.getElementById('result')
const pre=new URLSearchParams(location.search).get('action')
async function decide(d){
  if(needsPasskey&&d!=='deny'){
    if(navigator.credentials&&window.PublicKeyCredential){out.textContent='passkey available, spike skips the ceremony'}
    else{out.textContent='a passkey would be required here, not available in this browser'}
  }
  const r=await fetch('/decide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,decision:d})})
  out.textContent+=' result: '+r.status+' '+await r.text()
}
document.querySelectorAll('button').forEach(b=>b.onclick=()=>decide(b.dataset.d))
if(pre==='approve'||pre==='deny')decide(pre)
</script></body></html>`
}
