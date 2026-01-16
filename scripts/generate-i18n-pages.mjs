import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, '../dist');
const LOCALES_DIR = path.resolve(__dirname, '../public/locales');
const SITE_URL = process.env.SITE_URL || 'https://bentopdf.com';
const BASE_PATH = (process.env.BASE_URL || '/').replace(/\/$/, '');

const languages = fs.readdirSync(LOCALES_DIR).filter((file) => {
  return fs.statSync(path.join(LOCALES_DIR, file)).isDirectory();
});

const toCamelCase = (str) => {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
};

const KEY_MAPPING = {
  index: 'home',
  404: 'notFound',
};

// TODO@ALAM: Let users build only a single language
function buildUrl(langPrefix, pagePath) {
  const parts = [SITE_URL];
  if (BASE_PATH && BASE_PATH !== '') parts.push(BASE_PATH.replace(/^\//, ''));
  if (langPrefix) parts.push(langPrefix);
  if (pagePath) parts.push(pagePath.replace(/^\//, ''));
  return parts.filter(Boolean).join('/').replace(/\/+$/, '') || SITE_URL;
}

async function generateI18nPages() {
  console.log('🌍 Generating i18n pages...');
  console.log(`   SITE_URL: ${SITE_URL}`);
  console.log(`   BASE_PATH: ${BASE_PATH || '/'}`);

  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ dist directory not found. Please run build first.');
    process.exit(1);
  }

  const htmlFiles = fs
    .readdirSync(DIST_DIR)
    .filter((file) => file.endsWith('.html'));

  for (const file of htmlFiles) {
    const filePath = path.join(DIST_DIR, file);
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    const filenameNoExt = file.replace('.html', '');

    let translationKey = toCamelCase(filenameNoExt);
    if (KEY_MAPPING[filenameNoExt]) {
      translationKey = KEY_MAPPING[filenameNoExt];
    }

    // We only support 'zh' now, so we can skip generating other language directories
    // But we still want to apply 'zh' translations to the main files in DIST_DIR

    const lang = 'zh'; // Force Chinese
    const commonPath = path.join(LOCALES_DIR, `${lang}/common.json`);
    const toolsPath = path.join(LOCALES_DIR, `${lang}/tools.json`);

    const common = fs.existsSync(commonPath)
      ? JSON.parse(fs.readFileSync(commonPath, 'utf-8'))
      : {};
    const tools = fs.existsSync(toolsPath)
      ? JSON.parse(fs.readFileSync(toolsPath, 'utf-8'))
      : {};

    const dom = new JSDOM(originalContent);
    const document = dom.window.document;

    document.documentElement.lang = lang;

    let title = null;
    let description = null;

    if (tools[translationKey]) {
      title =
        tools[translationKey].pageTitle ||
        (tools[translationKey].name
          ? `${tools[translationKey].name} - BentoPDF`
          : null);
      description = tools[translationKey].subtitle;
    }

    if (title) {
      document.title = title;
      const metaTitle = document.querySelector('meta[property="og:title"]');
      if (metaTitle) metaTitle.content = title;
      const metaTwitterTitle = document.querySelector(
        'meta[name="twitter:title"]'
      );
      if (metaTwitterTitle) metaTwitterTitle.content = title;
    }

    if (description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.content = description;
      const metaOgDesc = document.querySelector(
        'meta[property="og:description"]'
      );
      if (metaOgDesc) metaOgDesc.content = description;
      const metaTwitterDesc = document.querySelector(
        'meta[name="twitter:description"]'
      );
      if (metaTwitterDesc) metaTwitterDesc.content = description;
    }

    // Clean up alternate links since we only have one language
    document
      .querySelectorAll('link[rel="alternate"][hreflang]')
      .forEach((el) => el.remove());

    // Translate elements
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const keys = key.split('.');
      let value = keys[0] === 'tools' ? tools : common;

      // Navigate the object
      for (let i = keys[0] === 'tools' ? 1 : 0; i < keys.length; i++) {
        value = value ? value[keys[i]] : null;
      }

      if (value) {
        if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
          el.setAttribute('placeholder', value);
        } else {
          el.textContent = value;
        }
      }
    });

    fs.writeFileSync(filePath, dom.serialize());
  }

  console.log('✅ i18n pages generated successfully!');
}

generateI18nPages().catch(console.error);
