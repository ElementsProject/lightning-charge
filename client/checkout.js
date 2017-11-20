const poll_url   = document.querySelector('meta[name=invoice-poll-url]').content
    , expires_at = document.querySelector('meta[name=invoice-expiry]').content;

(function poll() {
  const req = new XMLHttpRequest()
  req.addEventListener('load', ev =>
    ev.target.status === 204 ? location.reload()
  : ev.target.status === 402 ? poll()
  : setTimeout(poll, 10000))

  req.addEventListener('error', ev => setTimeout(poll, 10000))
  req.open('GET', poll_url)
  req.send()
})()

function updateExpiry() {
  const left = (expires_at - Date.now())/1000|0
  if (left > 0) document.querySelector('.expiry span').innerHTML = formatDur(left)
  else document.querySelector('.expiry').innerHTML = 'Invoice expired!'
}

function formatDur(x) {
  const m=x/60|0, s=x%60
  return ''+(m<10?'0':'')+m+':'+(s<10?'0':'')+s
}

updateExpiry()
setInterval(updateExpiry, 1000)
document.querySelector('.expiry').style.display='block'
