(function () {
  let template = document.createElement('template')
  template.innerHTML = `
    <style>
      :host {
        contain: content;
        background: white;
        --header-height: 60px;
        --footer-height: 84px;
        --dodger-blue: #5F55FF;
        --athens-gray: #E8EBEF;
        --fog: #DFDDFF;
        --pastel-green: #76dc76;
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

      .app-header {
        align-items: center;
        display: grid;
        grid-column-gap: 10px;
        grid-template-columns: max-content max-content;
        padding: 0 10px;
        border-bottom: 1px solid var(--fog);
      }

      .brand {
        display: block;
        margin: 0;
        padding: 0;
      }

      .body{
        display: grid;
        grid-template-columns: 240px 1fr;
        grid-column-gap: 10px;
      }

      .body-aside {
        border-right: 1px solid var(--athens-gray);
      }

      .user {
        line-height: 60px;
        padding: 0 10px;
      }
      .user:not(:last-child) {
        border-bottom: 1px solid var(--fog);
      }
      .user:before {
        background: var(--pastel-green);
        border-radius: 50%;
        content: '';
        display: inline-block;
        height: 9px;
        margin: 0 7px 0 0;
        width: 9px;
      }

      .user.is-self {
        font-weight: bold;
      }

      #share-url {
        height: 30px;
        line-height: 30px;
        padding: 0 15px;
        -webkit-appearance: none;
        border: 1px solid white;
        border-radius: 15px;
        background: var(--dodger-blue);
        color: white;
      }
      .url.is-hidden {
        display: none;
      }
      .url {
        font-size: 14px;
        height: calc(14px * 2);
        -webkit-appearance: none;
        border: 1px solid #DDDDDD;
        color: #222222;
      }
      footer {
        border-top: 1px solid var(--athens-gray);
        height: var(--footer-height);
        padding: 14px 14px 0 14px;
      }
      .message {
        background: white;
        border-radius: 7px;
        border: 1px solid var(--athens-gray);
        background: var(--athens-gray);
        font-size: 14px;
        height: 48px;
        outline: none;
        padding: 0 7px;
        width: 100%;
      }
      .message:active,
      .message:focus {
        border: 1px solid var(--fog);
      }
      
    </style>

    <div class='app'>
      <header class='app-header'>
        <h2 class='brand'>chat playground</h2>
        <div>
          <button id='share-url'>Share</button>
          <input type='text' onClick='this.setSelectionRange(0, this.value.length)' class='url is-hidden'/>
        </div>
      </header>
      <div class='body'>
        <aside class='body-aside'></aside>
        <main class='messages'></main>
      </div>
      <footer>
        <input class='message' type='text' placeholder='Type your message here' required/>
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
        let $users = this.shadowRoot.querySelector('.body-aside')
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

  function shortenName(name) {
    return name
      .replace(/[\W]/g,'_')
      .split('_')
      .map(str => str[0])
      .join('')
      .toUpperCase()
  }
})()
