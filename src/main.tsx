import React from 'react'
import ReactDOM from 'react-dom/client'
import DockView from './views/DockView'
import SettingsView from './views/SettingsView'
import StackView from './views/StackView'
import WidgetView from './views/WidgetView'
import './styles/base.css'
import './styles/dock.css'
import './styles/panels.css'
import './styles/widgets.css'
import './styles/settings.css'

const route = window.location.hash.replace(/^#/, '') || '/dock'
const [, view, param] = route.split('/')
document.documentElement.dataset.view = view

function Root() {
  switch (view) {
    case 'settings':
      return <SettingsView />
    case 'stack':
      return <StackView itemId={param} />
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
