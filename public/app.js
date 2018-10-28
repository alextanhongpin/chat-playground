(function () {
  let template = document.createElement('template')
  template.innerHTML = `
    <style>
      :host {
        contain: content;
      }

      .header {
        background: #EEEEEE;
      }

      .user {
        background: #DDDDDD;
        height: 40px;
        width: 40px;
        border-radius: 50%;
      }
      .user.is-self {
        border: 3px solid #4488FF;
      }

      .url.is-hidden {
        display: none;
      }
    </style>

    <div>
      <header>
        <h1 class='header'>chat playground</h1>
        <input type='text' onClick='this.setSelectionRange(0, this.value.length)' class='url is-hidden'/>
        <div id='share-url'>Share</div>
        <div class='users'></div>
      </header>
      <main class='messages'>
        No messages.
      </main>
      <footer>
        <input class='message' type='text' placeholder='Enter message' required/>
        <button id='submit'>Submit</button>
      </footer>
    </div>
  `

  class ChatApp extends HTMLElement {
    constructor () {
      super()
      this.attachShadow({ mode: 'open' })
        .appendChild(template.content.cloneNode(true))

      this.state = {
        socket: undefined,
        room: undefined,
        messages: new Map(),
        user: undefined,
        displayName: undefined,
        users: new Map(),
        $users: new WeakMap()
      }
    }
    set user ({ sender, display_name: displayName, text }) {
      if (!this.state.users.has(sender) && text === 'online') {

        let userObj = { sender, displayName, isSelf: sender === this.state.user }
        this.state.users.set(sender, userObj) 
        let $users = this.shadowRoot.querySelector('.users')

        console.log('checkObject', userObj, sender, this.state.user)
        let $user = document.createElement('div')
        $user.textContent = displayName
        $user.classList.add('user')
        userObj.isSelf && $user.classList.add('is-self')
        $users.appendChild($user)

        this.state.$users.set(userObj, $user)
      }
      if (this.state.users.has(sender) && text === 'offline') {
        let user = this.state.users.get(sender)
        let $user = this.state.$users.get(user)
        $user && $user.remove()
        this.state.$users.has(user) && this.state.$users.remove(user)
        this.state.users.remove(sender)
      }
    }
    connectedCallback () {
      let room = this.getAttribute('room')
      if (!room) {
        console.error(`attribute 'room' is required`)
        return
      }

      let displayName = window.prompt('Enter your username', 'green-goblin')
      if (!displayName.trim().length) {
        window.alert('Username cannot be empty')
        throw new Error('invalid session')
      }
      this.connect(displayName, room)

      let $buttonShareUrl = this.shadowRoot.getElementById('share-url')
      $buttonShareUrl.addEventListener('click', this.onShareUrl.bind(this))

      let $inputMessage = this.shadowRoot.querySelector('.message')
      let $buttonSubmit = this.shadowRoot.getElementById('submit')
      $buttonSubmit.addEventListener('click', this.onSendMessage.bind(this))
    }
    disconnectedCallback() {
      this.state.socket.close()
    }
    onShareUrl(evt) {
        let $url = this.shadowRoot.querySelector('.url')
        let url = window.location.href
        $url.value = url
        copyToClipboard(url)
        $url.classList.remove('is-hidden')
        evt.currentTarget.setAttribute("disabled", true)
    }
    onSendMessage(evt) {
      let $input = this.shadowRoot.querySelector('.message')
      if (!$input.value.trim().length) {
        return
      }
      this.state.socket.send(JSON.stringify({
        text: $input.value.trim(),
        room: this.state.room,
        type: 'message'
      }))
      $input.value = ''
    }
    connect(user, room) {
      this.state.displayName = user
      this.state.room = room

      let socket = new WebSocket(`ws://localhost:8000/ws?room=${room}&user=${user}`)
      this.state.socket = socket
      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: 'auth'
        }))
        socket.send(JSON.stringify({
          type: 'status'
        }))
        console.log('enquire status')
      }

      socket.onmessage = (evt) => {
        try {
          let msg = JSON.parse(evt.data)

          switch (msg.type) {
            case 'auth':
              this.state.user = msg.sender
              msg.text = 'online'
              // this.state.displayName = msg.display_name
              this.user = msg
            case 'message':
              this.addMessage(msg)
              break
            case 'presence':
              this.user = msg
              console.log(msg.display_name, msg.text, msg.sender === this.state.sender)
              break
            // case 'status':
            default:
              break
          }
          console.log(msg)
        } catch (error) {
          console.error(error)
        }
      }
    }
    addMessage(msg) {
      this.state.messages.set(msg.id, msg)
      let $messages = this.shadowRoot.querySelector('.messages')

      let $dialog = document.createElement('chat-dialog')
      $dialog.message = msg.text
      $dialog.isSelf = msg.sender === this.state.user
      $messages.appendChild($dialog)
    }
  }

  window.customElements.define('chat-app', ChatApp)

  function copyToClipboard (str) {
    const el = document.createElement('textarea') // Create a <textarea> element
    el.value = str // Set its value to the string that you want copied
    el.setAttribute('readonly', '') // Make it readonly to be tamper-proof
    el.style.position = 'absolute'
    el.style.left = '-9999px' // Move outside the screen to make it invisible
    document.body.appendChild(el) // Append the <textarea> element to the HTML document
    const selected =
      document.getSelection().rangeCount > 0 // Check if there is any content selected previously
        ? document.getSelection().getRangeAt(0) // Store selection if found
        : false // Mark as false to know no selection existed before
    el.select() // Select the <textarea> content
    document.execCommand('copy') // Copy - only works as a result of a user action (e.g. click events)
    document.body.removeChild(el) // Remove the <textarea> element
    if (selected) { // If a selection existed before copying
      document.getSelection().removeAllRanges() // Unselect everything on the HTML document
      document.getSelection().addRange(selected) // Restore the original selection
    }
  }
})()