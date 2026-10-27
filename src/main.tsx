import React from 'react'
import ReactDOM from 'react-dom/client'
import DockView from './views/DockView'
import SettingsView from './views/SettingsView'
import StackView from './views/StackView'
import WidgetView from './views/WidgetView'
import MenuView from './views/MenuView'
import './styles/base.css'
import './styles/dock.css'
import './styles/windows.css'
import './styles/widgets.css'
import './styles/settings.css'

const route = window.location.hash.replace(/^#/, '') || '/dock'
const [, rawView, rawParam] = route.split('/')
const view = rawView.split('?')[0]
const param = (rawParam ?? '').split('?')[0]
document.documentElement.dataset.view = view

function Root() {
  switch (view) {
    case 'settings':
      return <SettingsView />
    case 'stack':
      return <StackView itemId={param} />
    case 'menu':
      return <MenuView origin={new URLSearchParams(route.split('?')[1] ?? '').get('o') ?? 'tl'} />
    case 'widget':
      return <WidgetView widgetId={param} />
    default:
      return <DockView />
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
