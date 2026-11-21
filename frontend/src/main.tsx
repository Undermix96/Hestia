import '@fontsource-variable/albert-sans/wght.css';
import '@fontsource-variable/martian-mono/wght.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/motion.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createDataSource } from './api/datasource';
import { App } from './app/App';
import { locale, t } from './i18n';

document.documentElement.lang = locale;
document.title = t('app.name');

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// One data source for the page lifetime (?source / ?scenario are read once).
const dataSource = createDataSource();

createRoot(root).render(
  <StrictMode>
    <App dataSource={dataSource} />
  </StrictMode>,
);
