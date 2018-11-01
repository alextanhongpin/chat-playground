(function () {
  let template = document.createElement('template')
  template.innerHTML = `
    <style>
      :host {
        contain: content;
        --dodger-blue: #5F55FF;
        --athens-gray: #E8EBEF;
        --fog: #DFDDFF;
      }
      @keyframes bubble {
        from {
          opacity: 0;
          transform: translate3d(0, 100%, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }
      .dialog {
        display: grid;
        text-align: left;
        justify-content: flex-start;
        animation: bubble 0.174s ease-out forwards;
      }

      .dialog.is-self {
        justify-content: flex-end;
      }

      .dialog .message {
        background: var(--dodger-blue);
        color: white;
        padding: 0 21px;
        font-size: 14px;
        border-radius: 5px 21px 21px 5px;
        line-height: 35px;
        min-height: 35px;
        margin: 3px 0;
      }

      .dialog.is-self .message {
        border-radius: 21px 5px 5px 21px;
      }

      .dialog .message:first-child {
        border-radius: 21px 21px 21px 5px;
      }

      .dialog.is-self .message:first-child {
        border-radius: 21px 21px 5px 21px;
      }

      .dialog .message:last-child {
        border-radius: 5px 21px 21px 21px;
      }

      .dialog.is-self .message:last-child {
        border-radius: 21px 5px 21px 21px;
      }

      .dialog.is-self .message {
        background: var(--athens-gray);
        color: #222222;
      }
    </style>
    <div class='dialog'>
      <div class='message'>hello</div>
    </div>
  `

  class ChatDialog extends HTMLElement {
    constructor () {
      super()
      this.attachShadow({ mode: 'open' })
        .appendChild(template.content.cloneNode(true))

      this.state = {
        message: '',
        isSelf: false
      }
    }

    set message (value) {
      this.state.message = value

      let $message = this.shadowRoot.querySelector('.message')
      $message.textContent = value
    }

    set isSelf (value) {
      this.state.isSelf = value
      let $dialog = this.shadowRoot.querySelector('.dialog')
      value
        ? $dialog.classList.add('is-self')
        : $dialog.classList.remove('is-self')
    }
  }

  window.customElements.define('chat-dialog', ChatDialog)
})()
