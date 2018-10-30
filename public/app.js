(function () {
  let template = document.createElement('template')
  template.innerHTML = `
    <style>
      :host {
        contain: content;
        --header-height: 60px;
        --footer-height: 60px;
        background: white;
      }

      .app {
        background: white;
        display: grid;
        grid-template-columns: 1fr;
        grid-template-rows: var(--header-height) 1fr var(--footer-height);
        height: 100%;
        margin: auto;
        width: 100%;
      }

      header {
        align-items: center;
        background: #F7F7F7;
        display: grid;
        grid-column-gap: 10px;
        grid-template-columns: 1fr 1fr 1fr;
        padding: 0 10px;
      }

      .brand {
        display: block;
        margin: 0;
        padding: 0;
      }

      main {
        padding: 4px;
      }

      .user {
        background: #DDDDDD;
        border-radius: 50%;
        height: 40px;
        width: 40px;
      }
      .user.is-self {
        border: 3px solid #4488FF;
      }

      .url.is-hidden {
        display: none;
      }

      footer {
        align-items: center;
        background: white;
        border-top: 1px solid #EEEEEE;
        display: grid;
        grid-column-gap: 10px;
        grid-template-columns: 1fr 120px;
        height: var(--footer-height);
        padding: 0 10px;
      }
      .message {
        background: white;
        border-radius: 3px;
        border: none; 
        font-size: 15px;
        height: 36px;
        outline: none;
        padding: 0 4px;
        width: 100%;
      }
      #submit {
        -webkit-appearance: none;
        background: #4488ff;
        border-radius: 20px;
        border: none;
        color: white;
        font-size: 14px;
        font-weight: bold;
        height: 40px;
        min-width: 120px;
        padding: 0 20px;
      }
      #submit:hover {
        cursor: pointer;
        background: #4499FF;
      }
      
    </style>

    <div class='app'>
      <header>
        <h2 class='brand'>chat playground</h2>
        <div>
          <button id='share-url'>Share</button>
          <input type='text' onClick='this.setSelectionRange(0, this.value.length)' class='url is-hidden'/>
        </div>
        <div class='users'></div>
      </header>
      <main class='messages'>
      </main>
      <footer>
        <input class='message' type='text' placeholder='Type your message here' required/>
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
        this.state.$users.has(user) && this.state.$users.delete(user)
        this.state.users.delete(sender)
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
      $inputMessage.addEventListener('keydown', (evt) => {
        if (evt.keyCode === 13) {
          this.onSendMessage()
          return
        }
      })
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

      let id = window.localStorage.id
      let socket = new WebSocket(`ws://localhost:8000/ws?room=${room}&user=${user}&id=${id}`)
      this.state.socket = socket
      // socket.onopen = () => { }
      socket.onmessage = (evt) => {
        try {
          let msg = JSON.parse(evt.data)

          switch (msg.type) {
            case 'auth':
              this.state.user = msg.sender
              // Cache the id locally.
              window.localStorage.id = msg.sender
              this.user = msg
              break
            case 'message':
              this.addMessage(msg)
              break
            case 'presence':
              this.user = msg
              break
            default:
              break
          }
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
