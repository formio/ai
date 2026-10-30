# The chat widget

The chat widget turns any form tagged `uag` into a conversation. A person describes what they need; the chat asks only for what is still missing, maps the answers onto the form's own fields and options, refuses what the form would refuse, and, once they confirm a summary, submits the form through the UAG. The UAG is the only backend: each turn is the form's `{form}/agent/chat`, answered by one of the UAG's agent engines. There is no model code, no prompt and no server of the application's own.

Chat is part of conversation forms: it needs an agent engine on the UAG and **no Agentic Formflow license**, on Form.io Open Source or the hosted service (a self-hosted Enterprise project needs a license that includes the UAG to be served at all). Task fields are left to the server on purpose: when the chat's submission is saved, the form's Run task actions decide them.

## Contents

- [Embed a chat](#embed-a-chat)
- [How a conversation goes](#how-a-conversation-goes)
- [Setting up the form](#setting-up-the-form)
- [Options](#options)
- [Methods and events](#methods-and-events)
- [Templates, translations and styles](#templates-translations-and-styles)
- [Public forms](#public-forms)
- [Limits](#limits)

## Embed a chat

The chat is part of `@formio/uag-js` 2.x, with `@formio/js` 5; install the exact version resolved as [patterns-and-licensing.md](./patterns-and-licensing.md#versions) describes. Registering the module adds `Formio.createChat`:

```js
import { Formio } from '@formio/js';
import { UAG } from '@formio/uag-js';
import '@formio/uag-js/uag-js.css';

Formio.use(UAG(config.uagUrl));
const chat = await Formio.createChat(document.getElementById('chat'), `${config.formioProjectUrl}/servicerequest`);
chat.on('submitDone', (submission) => console.log('Saved', submission._id));
```

With script tags, pinned to that exact version as `{uagJsVersion}`:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@formio/js@5/dist/formio.full.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@formio/uag-js@{uagJsVersion}/uag-js.css">
<script src="https://cdn.jsdelivr.net/npm/@formio/js@5/dist/formio.full.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@formio/uag-js@{uagJsVersion}/index.js"></script>

<div id="chat"></div>
<script>
  Formio.use(FormioUAG.UAG('https://uag.example.com'));
  Formio.createChat(document.getElementById('chat'), 'https://forms.example.com/myproject/servicerequest')
    .then((chat) => chat.on('submitDone', (submission) => console.log('Saved', submission._id)));
</script>
```

`Formio.createChat(element, src, options)` is `Formio.createForm` for a chat. `src` is the form's **Form.io** URL (`{projectUrl}/{formPath}`), or its definition with its `_id` (and `project` on Enterprise and the hosted service) as Form.io returns it. Render from the URL when the chat should save: a definition has no URL to submit to. It resolves to the chat, a formio.js `Webform` rendered as a conversation, with the methods and events below on top of the form's own. A definition whose `display` is `"chat"` renders as a chat through `Formio.createForm` too. Allow the page's origin in the UAG's `CORS`.

The form view behind the chat (Review form, Edit in the form) is an ordinary formio.js form, so load the CSS framework the form's templates use (Bootstrap 5 for formio.js's defaults).

### In React and Angular

Register the module once at startup ([uag-js.md](./uag-js.md#in-react-and-angular-applications)), then create the chat on a host element after it mounts and destroy it when the component unmounts:

```tsx
import { useEffect, useRef } from 'react';
import { createChat, type ChatForm } from '@formio/uag-js';

export function ServiceRequestChat({ formUrl, onSaved }: { formUrl: string; onSaved: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const saved = useRef(onSaved);
  saved.current = onSaved;   // the latest callback, without re-creating the chat
  useEffect(() => {
    if (!host.current) return;
    let chat: ChatForm | undefined;
    let cancelled = false;
    createChat(host.current, formUrl)
      .then((created) => {
        if (cancelled) { created.destroy(true); return; }
        chat = created;
        chat.on('submitDone', (submission: { _id: string }) => saved.current(submission._id));
      })
      .catch((error: unknown) => console.error('The chat could not be created.', error));
    return () => { cancelled = true; chat?.destroy(true); };
  }, [formUrl]);
  return <div ref={host} />;
}
```

In Angular, create it in `ngAfterViewInit` against a `@ViewChild` element and call `destroy(true)` in `ngOnDestroy`, with the same cancelled-before-resolved guard.

## How a conversation goes

1. The chat shows a greeting and any `suggestions`.
2. The person sends a message. The chat posts the conversation, the form's current data, and the fields the person set in the form itself (`locked`) to `agent/chat`.
3. The UAG answers with the next message (`reply`) and the values it took (`patch`). The chat shows the reply and writes each value into the form's own component, so conditionals react at once. A refused value is not in `patch`; the reply asks again.
4. When the form is `complete`, the chat shows a summary with **Submit** and **Edit in the form**; the person can also confirm by typing, which the UAG reports as `confirmed`.
5. On submit, the chat calls the form's own `submit()`: formio.js validates and sends the submission to the UAG, which runs the form's actions and saves it in Form.io.

Nothing is submitted without the person's confirmation, and the UAG never submits. **Review form** shows the form behind the chat; a value the person changes there is theirs and is sent as `locked`. When a required field is one the chat cannot collect, the chat names it and opens the form. **Start over** clears the conversation and the values the chat wrote.

## Setting up the form

| Setting | Why |
| --- | --- |
| The `uag` tag | Without it the chat says "This form is not available for chat." |
| Create access for the people who chat | A turn needs create access to the form's submissions, as the save does. |
| `uagAnonymous: "true"` | Only for visitors who do not sign in. |
| `uagChat: "false"` | Turns chat off for the form. |
| `uagChatInstructions` | The form's own instructions to the chat ("Always ask for the account number first."). |

Labels, descriptions, tooltips, placeholders, validation messages and option labels are what the chat works from; write them for a person.

**Collected**: text, text areas, email, phone, number, currency, checkboxes, radios, select boxes, selects with static values, tags, date and time, day, URL, surveys, and fields inside containers, fieldsets, panels, columns and layout tables. **Never set**: a task's decision and value fields (a task's input is asked like any field), `uagAuthoritative` fields, hidden, disabled and calculated fields, fields in hidden panels, non-persisted fields. **Finished in the form**: data grids, edit grids, data tables, dynamic wizards, nested forms, data maps, addresses, file uploads, signatures, sketch pads, data sources, passwords, CAPTCHAs, selects fed by a URL or a resource. A form whose required fields are mostly in the last group is a poor fit for chat.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `uagUrl` | the URL given to `UAG()` | The UAG for this chat. |
| `chatUrl` | the form's `agent/chat` on the UAG | Where turns are posted instead, such as a relay. |
| `title` | the form's title | The header's title. |
| `greeting` | "Hi! I can help you fill in {{title}}. What would you like to tell me?" | The first message; `''` shows none. |
| `suggestions` | none | One-click messages, until the first is sent. |
| `placeholder`, `submitLabel`, `submitted` | "Type your message…", "Submit", "Thanks! Your form was submitted." | Composer and summary text. |
| `markdown` | none | A function from a reply's text to HTML, such as `marked.parse`. Its output is always sanitized. |
| `storage` | none | `'session'` or `'local'`: keep the conversation and data in the browser, per form and user. Prefer `'session'` on shared computers. |
| `maxMessages`, `maxMessageLength` | `40`, `2000` | Keep within the UAG's `agentApi.chat.maxMessages` and `maxMessageLength`. |
| `fetch` | the global `fetch` | The `fetch` turns are posted with. |

Every formio.js form option applies too: `templates`, `i18n`, `language`, `readOnly`, `hooks`, `noAlerts`.

## Methods and events

| Member | Meaning |
| --- | --- |
| `send(text)` | Send a message as if typed. Resolves with the turn's response, or `null`. |
| `messages` | The conversation so far, as `{ role, content }`. |
| `openForm()`, `closeForm()` | Show the form behind the chat, and return. |
| `submitChat()` | Submit, as the summary's button does. |
| `reset()` | Start over. |

| Event | Receives | When |
| --- | --- | --- |
| `chatMessage` | `{ role, content }` | A message is added. |
| `chatReply` | the turn's response (`reply`, `patch`, `fields`, `remaining`, `complete`, `confirmed`, `engine`) | Each answered turn. |
| `chatComplete` | the turn's response | The form became complete. |
| `chatError` | the error (`status` and `response` when the UAG answered) | A turn or the save failed. |
| `chatReset` | | The person started over. |
| `submitDone`, `submit`, `change`, `error` | as formio.js | The form's own events. |

## Templates, translations and styles

The chat renders through formio.js templates: `uagChat`, `uagChatMessage`, `uagChatTyping`, `uagChatSuggestions`, `uagChatComposer`, `uagChatSummary`, `uagChatNotice` (the built-ins are exported as `CHAT_TEMPLATES`). Replace one for a chat with `options.templates`, or for every chat with `Formio.use({ templates: { bootstrap5: { ... } } })`. Keep the `ref` attributes the replaced template held (`uagChat`, `uagChatLog`, `uagChatComposer`, `uagChatForm`, `uagChatOpen`, `uagChatClose`, `uagChatReset`, `uagChatInput`, `uagChatSend`, `uagChatSuggestion`, `uagChatSubmit`, `uagChatEdit`). In a string template, insert a message with `{{ ctx.html }}` (escaped, or sanitized markdown) — never `{{ ctx.text }}`, which `{{ }}` inserts as is. A notice is the one template with no `html`: its `text` may carry a server's error message, so the example below relies on the chat sanitizing every template's output before it is inserted; a function template should escape it, as the built-in one does.

```js
Formio.createChat(element, formUrl, {
  templates: {
    uagChatNotice: { form: '<div class="alert alert-{{ ctx.kind === "error" ? "danger" : "info" }}">{{ ctx.text }}</div>' }
  }
});
```

Every fixed string goes through formio.js translation with its English text as the key (`'Send'`, `'Start over'`, `'Review form'`, `'Back to chat'`, `'Type your message…'`, `'Please check your answers'`, `'Submit'`, `'Edit in the form'`, the greeting), so `language` and `i18n` translate the chat. Replies are written in the language the person writes in.

`uag-js.css` themes the chat with CSS custom properties set on the container or an ancestor: `--uag-chat-font`, `--uag-chat-bg`, `--uag-chat-surface`, `--uag-chat-text`, `--uag-chat-muted`, `--uag-chat-border`, `--uag-chat-accent`, `--uag-chat-accent-text`, `--uag-chat-user-bg`, `--uag-chat-user-text`, `--uag-chat-radius`, `--uag-chat-height` (default `560px`; `100%` fills the container).

## Public forms

- **Anonymous use**: `uagAnonymous: "true"` on the form and create access for the Anonymous role. Anonymous turns count against `AGENT_ANONYMOUS_RATE_LIMIT` (10 a minute per address) and `AGENT_ANONYMOUS_TOTAL_RATE_LIMIT` (100 a minute), per UAG process. Every turn spends model budget: set the limits for what the owner will pay, and a spend limit at the model provider.
- **A relay of your own**, for a CAPTCHA, a daily budget or your own sessions: either point only the turns at it with `chatUrl`, or register the relay's base URL as the UAG's (`Formio.use(UAG(relayUrl))`) and have it serve the UAG's paths for the form — the form (`{relay}/{formPath}`), its turns (`{relay}[/project/{id}]/form/{id}/agent/chat`) and its save (`{relay}[/project/{id}]/form/{id}/submission`). Each turn's `engine.usage` reports token use, for a relay that keeps a budget.

## Limits

A turn carries at most 40 messages of at most 2000 characters, and the UAG sends the engine the newest 24,000 characters (`agentApi.chat`). Callers are rate-limited per operation with `agentApi.rateLimits.caller.chat`. The engines tried are `agentApi.chat.engines` (default: every agent engine, in order); to give the chat a faster model than value fields, enable a second instance (`UAG_ENGINES=jev,deep:claude,chat:claude` with `UAG_ENGINE_CHAT_MODEL=claude-haiku-5-5`) and name it in both lists in a module's `config`: `routing: { value: ['deep'] }` (so the chat instance is not also a fallback for value and decision fields) and `agentApi: { chat: { engines: ['chat', 'deep'] } }`.
