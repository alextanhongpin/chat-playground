(function () {
  let pattern = /^\/rooms\/(\w+)$/
  if (!pattern.test(window.location.pathname)) {
    window.location.replace('/lobby')
  }
})()

