type LocaleKey = 'en' | 'zh-CN';

declare global {
  interface Window {
    __LOCALE__?: string;
  }
}

const messages: Record<LocaleKey, Record<string, string>> = {
  en: {
    'tab.installed': 'Installed',
    'tab.marketplace': 'Marketplace',
    'errorBoundary.title': 'Something went wrong!',
    'installed.loading': 'Loading installed skills...',
    'installed.empty.title': 'No Skills Installed',
    'installed.empty.desc': 'Install skills from the marketplace to enhance your workflow.',
    'installed.empty.browse': 'Browse Marketplace',
    'installed.scope.global': 'Show global skills',
    'installed.scope.toggle': 'Toggle global skills visibility',
    'market.search.placeholder': "Search for skills (e.g., 'git', 'testing', 'debugging')",
    'market.search.aria': 'Search skills',
    'market.search.button': 'Search',
    'market.loading': 'Searching marketplace...',
    'market.error.default': 'Search failed. Please try again.',
    'market.error.dismiss': 'Dismiss',
    'market.empty.before.title': 'Discover Skills',
    'market.empty.before.desc': 'Search the marketplace to find and install skills for your agents.',
    'market.empty.before.popular': 'Popular searches:',
    'market.empty.none.title': 'No Results Found',
    'market.empty.none.desc': 'Try different keywords or check your spelling.',
    'card.menu.actions': 'Actions',
    'card.menu.openDoc': 'Open Documentation',
    'card.menu.update': 'Update',
    'card.menu.remove': 'Remove',
    'card.menu.install': 'Install',
    'card.menu.repo': 'Open Repository'
  },
  'zh-CN': {
    'tab.installed': '已安装',
    'tab.marketplace': '市场',
    'errorBoundary.title': '页面发生错误',
    'installed.loading': '正在加载已安装技能...',
    'installed.empty.title': '暂无已安装技能',
    'installed.empty.desc': '可从市场安装技能来增强你的工作流。',
    'installed.empty.browse': '浏览市场',
    'installed.scope.global': '显示全局技能',
    'installed.scope.toggle': '切换全局技能显示',
    'market.search.placeholder': "搜索技能（例如 'git'、'testing'、'debugging'）",
    'market.search.aria': '搜索技能',
    'market.search.button': '搜索',
    'market.loading': '正在搜索市场...',
    'market.error.default': '搜索失败，请重试。',
    'market.error.dismiss': '关闭',
    'market.empty.before.title': '发现技能',
    'market.empty.before.desc': '在市场中搜索并安装适用于你的 Agent 的技能。',
    'market.empty.before.popular': '热门搜索：',
    'market.empty.none.title': '未找到结果',
    'market.empty.none.desc': '试试其他关键词或检查拼写。',
    'card.menu.actions': '操作',
    'card.menu.openDoc': '打开文档',
    'card.menu.update': '更新',
    'card.menu.remove': '卸载',
    'card.menu.install': '安装',
    'card.menu.repo': '查看仓库'
  }
};

function resolveLocale(): LocaleKey {
  const locale = (window.__LOCALE__ || '').toLowerCase();
  return locale.startsWith('zh') ? 'zh-CN' : 'en';
}

export function t(key: string): string {
  const locale = resolveLocale();
  return messages[locale][key] || messages.en[key] || key;
}
