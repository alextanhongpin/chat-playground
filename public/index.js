(function () {

  // TODO: Add beforeunload.
  let pattern = /^\/chat\/(\w)$/
  if (!pattern.test(window.location.pathname)) {
    let alphabets = [...'abcdefghijklmnopqrstuvwxyz']
    let room = alphabets[Math.floor(Math.random() * alphabets.length)]
    window.location.replace('/chat/'+room)
  }

})()

