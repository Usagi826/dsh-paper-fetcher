/**
 * Browser half of `dsh-paper-fetcher`.
 *
 * Registers two slots:
 *  - `sidebar.panellist` — the "文献下载" icon in the left column's global panel
 *    list, under the shipped "自动化" entries and above session import. It
 *    carries a count badge for the persisted download history.
 *  - `main` — the panel page, keyed by the same id, which the sidebar selects.
 *
 * All Harness calls go through this package's own Host route
 * (`/paper-download/*`); the page is plain React styled with theme tokens.
 */
window.__ModuleLoader__.load({
  id: 'dsh-paper-fetcher',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // This build uses a fresh storage namespace, so drop whatever the earlier
    // `dsh-paper-download` build left behind in this browser once per load.
    try {
      ['dsh-paper-download.directory', 'dsh-paper-download.email',
        'dsh-paper-download.history.v1', 'dsh-paper-download.history.seen.v1']
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage unavailable (private mode, quota): nothing to clean.
    }

    const PANEL_ID = 'paper-download';
    const ROUTE = '/paper-download';
    const DIRECTORY_KEY = 'dsh-paper-fetcher.directory';
    const EMAIL_KEY = 'dsh-paper-fetcher.email';

    // ------------------------------------------------------------------ copy

    const ZH = {
      panel: '文献下载',
      title: '文献下载',
      subtitle: '输入标题、DOI 或 arXiv 编号，自动下载开放获取全文。',
      placeholder: '论文标题 / DOI / arXiv 编号',
      search: '下载',
      searchHint: 'Enter 开始下载',
      directory: '保存到',
      pickFolder: '选择文件夹',
      folderTitle: '选择保存位置',
      folderDesktop: '桌面',
      folderHome: '主目录',
      folderUp: '上一级',
      folderEmpty: '这个文件夹里没有子文件夹',
      folderApply: '使用此文件夹',
      folderCancel: '取消',
      folderLoading: '正在读取文件夹…',
      email: '联系邮箱',
      emailPlaceholder: 'you@example.com（可选，用于开放获取查询）',
      searching: '正在检索并下载…',
      searchingHint: '按来源依次查找，通常 10–60 秒。',
      searchingBackground: '切换到其他面板不会中断，回来仍能看到进度。',
      elapsedRunning: '已用时 {n} 秒',
      openFolder: '打开所在文件夹',
      source: '来源',
      doi: 'DOI',
      year: '年份',
      venue: '期刊 / 来源',
      authors: '作者',
      showAbstract: '展开摘要',
      hideAbstract: '收起摘要',
      tried: '下载尝试',
      attempts: '共尝试 {n} 个链接',
      failedTitle: '未能自动下载',
      failedHint: '付费墙文献需要机构网络手动下载；可打开下列链接自行获取。',
      manual: '手动获取链接',
      alternatives: '可能的匹配结果',
      clearHistory: '清空记录',
      lastResults: '下载记录',
      historyCount: '共 {n} 条',
      historyEmptyHint: '含未成功下载的条目，会一直保留。',
      historyLoaded: '来自历史记录，点击「重新下载」可再次尝试。',
      removeEntry: '删除这条记录',
      fileSize: '大小',
      elapsed: '耗时',
      errorTitle: '出错了',
      manualSearch: '手动搜索',
      manualSearchHint: '用默认浏览器在 cn.bing.com 搜索这篇文献的标题',
      resultBroken: '这条记录的展示出了点问题，但下载记录仍然保留在下方列表中。',
      batchHint: '检测到多行内容：提交后将逐条识别并依次下载（Shift+Enter 换行）。',
      batchRunning: '批量下载中',
      batchDone: '批量完成',
      batchProgress: '{done}/{total}',
      batchOk: '成功',
      batchFail: '失败',
      batchStop: '停止',
      batchStopping: '正在停止…',
      batchClose: '关闭',
      batchWaiting: '等待中',
      batchItemRunning: '正在检索…',
      sourceOpenAccess: '开放获取',
      sourceSemantic: 'Semantic Scholar',
      sourceArxiv: 'arXiv',
      sourcePreprint: '预印本',
      sourcePublisher: '出版商页面',
      sourceDirect: '直链',
      statusOk: '成功',
      statusFail: '失败',
      notSaved: '未保存',
      downloadAgain: '重新下载',
    };
    const EN = {
      panel: 'Paper Download',
      title: 'Paper Download',
      subtitle: 'Enter a title, DOI or arXiv id to download the open-access PDF.',
      placeholder: 'Paper title / DOI / arXiv id',
      search: 'Download',
      searchHint: 'Press Enter to start',
      directory: 'Save to',
      pickFolder: 'Choose folder',
      folderTitle: 'Choose a folder',
      folderDesktop: 'Desktop',
      folderHome: 'Home',
      folderUp: 'Parent folder',
      folderEmpty: 'No sub-folders here',
      folderApply: 'Use this folder',
      folderCancel: 'Cancel',
      folderLoading: 'Reading folders…',
      email: 'Contact email',
      emailPlaceholder: 'you@example.com (optional, used for open-access lookup)',
      searching: 'Searching and downloading…',
      searchingHint: 'Trying sources in order; usually 10–60 s.',
      searchingBackground: 'Switching panels does not interrupt the download.',
      elapsedRunning: '{n} s elapsed',
      openFolder: 'Open containing folder',
      source: 'Source',
      doi: 'DOI',
      year: 'Year',
      venue: 'Venue',
      authors: 'Authors',
      showAbstract: 'Show abstract',
      hideAbstract: 'Hide abstract',
      tried: 'Download attempts',
      attempts: '{n} links tried',
      failedTitle: 'Could not download automatically',
      failedHint: 'Paywalled papers need an institutional network. Open one of these links manually.',
      manual: 'Manual links',
      alternatives: 'Possible matches',
      clearHistory: 'Clear history',
      lastResults: 'Download history',
      historyCount: '{n} saved',
      historyEmptyHint: 'Includes failed attempts; records are kept.',
      historyLoaded: 'Restored from the saved history; press "Download again" to retry.',
      removeEntry: 'Remove this record',
      fileSize: 'Size',
      elapsed: 'Elapsed',
      errorTitle: 'Something went wrong',
      manualSearch: 'Search manually',
      manualSearchHint: 'Search this paper\'s title on cn.bing.com in your default browser',
      resultBroken: 'This record could not be displayed, but it is still kept in the list below.',
      batchHint: 'Multiple lines detected: each entry is recognised and downloaded in turn (Shift+Enter for a new line).',
      batchRunning: 'Downloading list',
      batchDone: 'List finished',
      batchProgress: '{done}/{total}',
      batchOk: 'OK',
      batchFail: 'Failed',
      batchStop: 'Stop',
      batchStopping: 'Stopping…',
      batchClose: 'Close',
      batchWaiting: 'Waiting',
      batchItemRunning: 'Searching…',
      sourceOpenAccess: 'Open access',
      sourceSemantic: 'Semantic Scholar',
      sourceArxiv: 'arXiv',
      sourcePreprint: 'Preprint',
      sourcePublisher: 'Publisher page',
      sourceDirect: 'Direct link',
      statusOk: 'Saved',
      statusFail: 'Failed',
      notSaved: 'not saved',
      downloadAgain: 'Download again',
    };

    // ---------------------------------------------------------------- styles

    const CSS = `
.pdl-page{display:flex;flex-direction:column;height:100%;min-height:0;overflow:auto;box-sizing:border-box;
  padding:28px 32px 36px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px;
  /* The bar is reserved and transparent, never toggled: showing it when the
     records are cleared would shrink the content and make the layout jump. */
  scrollbar-gutter:stable both-edges;scrollbar-color:transparent transparent}
.pdl-page:hover,.pdl-page:focus-within{scrollbar-color:var(--dsw-alias-border-l2) transparent}
/* Lists stay under the fold: clearing the records then changes content only. */
.pdl-inner{width:100%;max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:18px;min-height:0}
.pdl-historyList{display:flex;flex-direction:column;gap:6px;overflow-y:auto;max-height:420px;
  scrollbar-gutter:stable;scrollbar-color:transparent transparent}
.pdl-historyList:hover{scrollbar-color:var(--dsw-alias-border-l2) transparent}
.pdl-head{display:flex;align-items:flex-start;gap:12px}
.pdl-head-mark{flex:none;width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;
  background:var(--dsw-alias-bg-layer-2);margin-top:2px}
.pdl-title{margin:0;font-size:18px;line-height:26px;font-weight:600}
.pdl-sub{margin:2px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.pdl-card{border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);
  padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.pdl-field{display:flex;flex-direction:column;gap:6px}
.pdl-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
/*
 * One control metric everywhere: 38px tall, 9px radius, 12px horizontal padding.
 * Both rows share the same gap and alignment, so the search button lines up with
 * the path button and every field starts and ends on the same edges.
 */
.pdl-searchRow,.pdl-pathRow{display:flex;gap:8px;align-items:flex-start}
.pdl-input{flex:1;min-width:0;box-sizing:border-box;height:38px;padding:7px 12px;font:inherit;font-size:14px;
  color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);
  border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;outline:none}
.pdl-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.85}
.pdl-input:focus{border-color:var(--dsw-alias-brand-primary)}
.pdl-input:disabled{opacity:.65;cursor:not-allowed}
/*
 * The query box grows with its content, never by dragging: the row count is
 * driven by the text (see lineCount), and past ten lines it scrolls inside
 * instead of pushing the rest of the panel down.
 */
.pdl-queryBox{height:auto;min-height:38px;max-height:220px;padding:9px 12px;line-height:20px;
  resize:none;overflow-y:hidden;font-family:inherit;white-space:pre-wrap;overflow-wrap:anywhere}
.pdl-button{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;
  height:38px;padding:0 14px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;border-radius:9px;
  border:.5px solid transparent;background:var(--dsw-alias-brand-primary);
  color:var(--dsw-alias-label-primary-foreground);white-space:nowrap}
/*
 * The search button keeps its 38px height even when the box has grown: it
 * stays aligned with the first line of the text instead of stretching.
 */
.pdl-searchRow>.pdl-button{align-self:flex-start}
.pdl-button:hover:not(:disabled){filter:brightness(1.06)}
.pdl-button:disabled{opacity:.55;cursor:not-allowed}
.pdl-button.ghost{background:transparent;color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.pdl-button.ghost:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);filter:none}
.pdl-button.small{height:30px;padding:0 12px;font-size:13px;border-radius:8px}
/* A secondary control that spans the field width, matching the inputs above. */
.pdl-button.wide{flex:1 1 auto;justify-content:flex-start;font-weight:400;color:var(--dsw-alias-label-secondary)}
/* The path field matches the text input exactly: same height, radius, padding. */
.pdl-path{flex:1;min-width:0;box-sizing:border-box;display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;
  border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-base);
  color:var(--dsw-alias-label-primary);font-size:14px;overflow:hidden}
/* The email is an editable field; pdl-path supplies only its frame. */
.pdl-path input{border:0;background:transparent;outline:none;font:inherit;color:inherit;flex:1;min-width:0;padding:0}
/* pdl-pathText elides long paths from the left (direction:rtl); reusing it on an
   editable input turns the text direction around, so the email gets its own. */
.pdl-pathText{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
.pdl-path input.pdl-pathText{direction:ltr;text-align:left;text-overflow:clip}
.pdl-pathIcon{flex:none;color:var(--dsw-alias-label-secondary);display:inline-flex}
.pdl-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pdl-status{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:10px;
  border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);font-size:13px;line-height:20px}
.pdl-status.ok{border-color:var(--dsw-alias-state-success-primary)}
.pdl-status.fail{border-color:var(--dsw-alias-state-error-primary)}
.pdl-statusIcon{flex:none;display:inline-flex;margin-top:1px}
.pdl-status.ok .pdl-statusIcon{color:var(--dsw-alias-state-success-primary)}
.pdl-status.fail .pdl-statusIcon{color:var(--dsw-alias-state-error-primary)}
.pdl-spin{animation:pdl-spin 1s linear infinite;display:inline-flex}
@keyframes pdl-spin{to{transform:rotate(360deg)}}
.pdl-fileName{font-weight:600;overflow-wrap:anywhere}
.pdl-filePath{color:var(--dsw-alias-label-secondary);font-size:12px;overflow-wrap:anywhere;margin-top:2px}
.pdl-metaGrid{display:grid;grid-template-columns:76px minmax(0,1fr);gap:6px 12px;font-size:13px;line-height:20px}
.pdl-metaKey{color:var(--dsw-alias-label-secondary)}
.pdl-metaValue{min-width:0;overflow-wrap:anywhere}
.pdl-abstractWhite{white-space:pre-wrap}
.pdl-list{display:flex;flex-direction:column;gap:6px}
.pdl-attempt{display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:18px}
.pdl-attemptMark{flex:none;width:14px;display:inline-flex;justify-content:center;margin-top:2px}
.pdl-attempt.ok .pdl-attemptMark{color:var(--dsw-alias-state-success-primary)}
.pdl-attempt.fail .pdl-attemptMark{color:var(--dsw-alias-state-error-primary)}
.pdl-attemptBody{min-width:0;flex:1}
.pdl-attemptUrl{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}
.pdl-attemptReason{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.pdl-link{color:var(--dsw-alias-brand-primary);text-decoration:none;overflow-wrap:anywhere}
.pdl-link:hover{text-decoration:underline}
.pdl-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pdl-spacer{flex:1}
.pdl-chip{display:inline-flex;align-items:center;gap:4px;font-size:12px;line-height:18px;padding:1px 8px;
  border-radius:9px;border:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.pdl-chip.ok{color:var(--dsw-alias-state-success-primary);border-color:currentColor}
.pdl-chip.warn{color:var(--dsw-alias-state-warn-primary);border-color:currentColor}
.pdl-sectionTitle{font-size:13px;font-weight:600;line-height:20px}
.pdl-sectionHead{display:flex;align-items:center;gap:8px}
.pdl-historyMeta{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.pdl-historyRecord{display:flex;align-items:stretch;border-radius:8px;border:.5px solid var(--dsw-alias-border-l2);
  background:transparent;overflow:hidden}
.pdl-historyRecord:hover{background:var(--dsw-alias-bg-layer-2)}
.pdl-historyRow{display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;flex:1;min-width:0;
  border:none;background:transparent;font:inherit;text-align:left;color:inherit}
.pdl-historyMain{min-width:0;flex:1;display:flex;flex-direction:column}
.pdl-historyName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.pdl-historySub{font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pdl-dot{display:inline-block;width:7px;height:7px;border-radius:4px;flex:none}
.pdl-dot.ok{background:var(--dsw-alias-state-success-primary)}
.pdl-dot.fail{background:var(--dsw-alias-state-error-primary)}
.pdl-iconButton{flex:none;display:inline-flex;align-items:center;justify-content:center;width:32px;
  border:none;border-left:.5px solid var(--dsw-alias-border-l1);background:transparent;
  color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0}
.pdl-iconButton:hover{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-2)}
.pdl-error{padding:12px 14px;border-radius:10px;border:.5px solid var(--dsw-alias-state-error-primary);
  background:var(--dsw-alias-bg-layer-2);font-size:13px;line-height:20px;overflow-wrap:anywhere}
.pdl-crumbs{display:flex;flex-wrap:wrap;gap:2px;align-items:center;font-size:12px;line-height:18px;
  color:var(--dsw-alias-label-secondary);padding:0 2px 6px;overflow-wrap:anywhere}
.pdl-crumb{font:inherit;font-size:12px;background:transparent;border:none;color:var(--dsw-alias-label-secondary);
  cursor:pointer;padding:1px 4px;border-radius:5px}
.pdl-crumb:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pdl-crumb.last{color:var(--dsw-alias-label-primary);font-weight:600}
.pdl-folderList{display:flex;flex-direction:column;gap:2px;max-height:280px;overflow:auto;
  border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;padding:4px}
.pdl-folder{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;cursor:pointer;
  border:none;background:transparent;font:inherit;font-size:13px;color:inherit;text-align:left;width:100%}
.pdl-folder:hover{background:var(--dsw-alias-bg-layer-2)}
.pdl-folderIcon{flex:none;color:var(--dsw-alias-label-secondary);display:inline-flex}
.pdl-folderName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pdl-overlay{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb, var(--dsw-alias-bg-base) 45%, transparent);padding:24px}
.pdl-modal{width:100%;max-width:560px;box-sizing:border-box;border-radius:14px;display:flex;flex-direction:column;
  gap:12px;padding:18px 20px 16px;background:var(--dsw-alias-bg-overlay);
  border:.5px solid var(--dsw-alias-border-l2);box-shadow:0 18px 48px var(--dsw-alias-border-l2)}
.pdl-modalTitle{font-size:15px;line-height:22px;font-weight:600}
.pdl-modalFoot{display:flex;justify-content:flex-end;gap:8px}
.pdl-launcher{position:relative;display:inline-flex;align-items:center;justify-content:center;line-height:0;cursor:pointer}
.pdl-venueShort{color:var(--dsw-alias-label-secondary)}
/* A plain dot: 7px circle, no number, no text. */
.pdl-dot-mark{position:absolute;top:-2px;right:-4px;width:7px;height:7px;border-radius:50%;
  background:var(--dsw-alias-brand-primary);pointer-events:none;
  box-shadow:0 0 0 1.5px var(--dsw-specific-sidebar-fill)}
/* While a download runs the dot pulses; it rests steady when records are unread. */
.pdl-dot-mark.running{animation:pdl-dot-pulse 1.4s ease-in-out infinite}
@keyframes pdl-dot-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}
@media (prefers-reduced-motion:reduce){.pdl-dot-mark.running{animation:none}}
/*
 * Dark palette. The shell publishes data-ds-dark-theme on <body> and every
 * --dsw-alias-* token already flips with it, so the panel needs no per-theme
 * colours; only the two effects the tokens cannot express are tuned here: the
 * overlay scrim (a dark wash over a dark page hides the dialog edges) and the
 * drop shadow behind the dialog, which must read as depth, not as a smear.
 */
body[data-ds-dark-theme] .pdl-overlay{background:color-mix(in srgb, #000 58%, transparent)}
body[data-ds-dark-theme] .pdl-modal{box-shadow:0 18px 48px #00000080}
body[data-ds-dark-theme] .pdl-button:hover:not(:disabled){filter:brightness(1.12)}
`;

    /** Insert the page stylesheet once; the returned disposer removes it. */
    function installStyles() {
      if (typeof document === 'undefined') return () => {};
      const existing = document.querySelector('style[data-plugin-css="dsh-paper-fetcher"]');
      if (existing !== null) return () => {};
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-paper-fetcher';
      tag.dataset.pluginCss = 'dsh-paper-fetcher';
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => tag.remove();
    }

    // --------------------------------------------------------------- storage

    /** Thin, failure-tolerant localStorage access. */
    const readLocal = (key) => {
      try {
        const value = window.localStorage.getItem(key);
        return value === null ? '' : value;
      } catch {
        return '';
      }
    };
    const writeLocal = (key, value) => {
      try {
        if (value === '') window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {
        // Sandboxed frames and full stores: the value simply is not remembered.
      }
    };

    // --------------------------------------------------------------- history

    /**
     * Download history persisted in the browser, so it survives closing the
     * panel, switching pages and restarting the app. Entries are plain JSON;
     * a corrupt or older document is dropped instead of breaking the panel.
     *
     * `lastSeenAt` marks how far the record list has been viewed: anything
     * newer than it is "unread" and drives the sidebar dot, which disappears
     * as soon as the panel has been looked at.
     */
    const HISTORY_KEY = 'dsh-paper-fetcher.history.v1';
    const HISTORY_VERSION = 1;
    const HISTORY_LIMIT = 50;
    const HISTORY_KEEP_MS = 90 * 24 * 60 * 60 * 1000;

    const UNREAD_KEY = 'dsh-paper-fetcher.history.seen.v1';

    function readHistory() {
      try {
        const raw = window.localStorage.getItem(HISTORY_KEY);
        if (raw === null) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const now = Date.now();
        return parsed
          .filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.query === 'string')
          .filter((entry) => typeof entry.at === 'number' && !Number.isNaN(entry.at))
          .filter((entry) => now - entry.at < HISTORY_KEEP_MS)
          .sort((left, right) => right.at - left.at)
          .slice(0, HISTORY_LIMIT);
      } catch {
        return [];
      }
    }

    function writeHistory(entries) {
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
      } catch {
        // Keep the in-memory list; only persistence failed.
      }
    }

    /** Timestamp up to which the user has already seen the record list. */
    function readSeen() {
      const value = Number(readLocal(UNREAD_KEY));
      return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function writeSeen(at) {
      writeLocal(UNREAD_KEY, String(Math.max(readSeen(), at)));
    }

    // ------------------------------------------------------------- file names

    /**
     * Characters and reserved names Windows refuses inside a file name. This
     * mirrors `safeNamePart` in `lib/shared.js`: the Host builds the real file
     * name, but a failed download never gets one, and the records must still
     * show where the file would have been saved.
     */
    const BAD_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;
    const RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

    /** One segment of a file name: legal characters only, capped in length. */
    function safeNamePart(value, maxLength) {
      let text = String(value ?? '')
        .replace(BAD_NAME_CHARS, ' ')
        .replace(/\s*-\s*-\s*/g, ' - ')
        .replace(/ {2,}/g, ' ')
        .replace(/^[\s.-]+/, '')
        .replace(/[\s.-]+$/, '');
      if (text.length > maxLength) {
        const cut = text.slice(0, maxLength);
        const lastSpace = cut.lastIndexOf(' ');
        text = (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
      }
      if (RESERVED_NAME.test(text)) text = `_${text}`;
      return text;
    }

    /**
     * The file name a download uses (`{year} - {journal} - {title}.pdf`), or
     * the planned name when nothing was saved. Prefers the name the Host
     * reported, so a record always shows exactly what a successful download
     * would have been called.
     * @param metadata - `{ year, venue, venueShort, title, doi, arxiv }`.
     * @param query - what the user typed, used when no title could be resolved.
     * @param file - the saved file, when the download worked.
     * @returns the `.pdf` name, never empty.
     */
    function resolveName(metadata, query, file) {
      const saved = String(file?.name ?? '');
      if (saved !== '') return saved;
      const year = /^\d{4}$/.test(String(metadata?.year ?? '')) ? String(metadata.year) : '';
      // The Host writes the abbreviated journal into the file name — except for
      // Chinese journals, which have no abbreviation and keep their full title.
      const full = String(metadata?.venue ?? '');
      const venueSource = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(full)
        ? full
        : (metadata?.venueShort || full);
      const venue = safeNamePart(venueSource, 80).replace(/\.+$/, '');
      let title = safeNamePart(metadata?.title ?? '', 140);
      if (title === '') {
        title = safeNamePart(query ?? '', 140);
        // A bare link or id makes a poor title; the DOI / arXiv id reads better.
        const bareId = title.toLowerCase() === String(query ?? '').trim().toLowerCase() && (metadata?.doi || metadata?.arxiv);
        if (title === '' || /^https?:\/\//i.test(title) || bareId) {
          title = safeNamePart(metadata?.doi || (metadata?.arxiv ? `arXiv-${metadata.arxiv}` : query) || '', 140);
        }
      }
      if (title === '') title = 'Untitled paper';
      const stem = [year, venue, title].filter((part) => part !== '').join(' - ');
      return `${stem}.pdf`.slice(0, 240);
    }

    /**
     * Keep only what the panel can render later: the query, whether it worked,
     * the saved file and its identifying metadata. Everything the result card
     * shows is copied, so a record opened next week looks like the live result.
     *
     * A failed attempt has no file, so it stores the name it would have been
     * saved under; every record then reads the same way in the list.
     */
    function toEntry(result) {
      const metadata = result?.metadata ?? {};
      const query = String(result?.query ?? '');
      const directory = String(result?.directory ?? '');
      const file = result?.file
        ? {
          name: String(result.file.name ?? ''),
          path: String(result.file.path ?? ''),
          bytes: Number(result.file.bytes) || 0,
          source: String(result.file.source ?? ''),
          url: String(result.file.url ?? ''),
          pages: Number(result.file.pages) || 0,
        }
        : null;
      const name = resolveName(metadata, query, file);
      return {
        v: HISTORY_VERSION,
        at: Date.now(),
        query,
        status: result?.status === 'downloaded' ? 'downloaded' : 'failed',
        directory,
        // Saved bytes for a download, the planned path for a failed attempt:
        // the records show one name per row either way.
        file,
        name,
        plannedPath: file === null && directory !== '' && name !== ''
          ? `${directory.replace(/[\\/]+$/, '')}\\${name}`
          : '',
        metadata: {
          doi: String(metadata.doi ?? ''),
          title: String(metadata.title ?? ''),
          year: String(metadata.year ?? ''),
          venue: String(metadata.venue ?? ''),
          venueShort: String(metadata.venueShort ?? ''),
          authors: Array.isArray(metadata.authors) ? metadata.authors.slice(0, 12) : [],
        },
        message: String(result?.message ?? ''),
      };
    }

    /**
     * One module-wide snapshot shared by the badge and the page, so a new
     * download updates both without either of them rereading storage. The
     * snapshot is `{ entries, seenAt }`; entries newer than `seenAt` are unread.
     * The object is built first and filled in afterwards, because every method
     * reads `historyStore.snapshot` through the same binding.
     */
    const historyStore = {};

    historyStore.snapshot = { entries: readHistory(), seenAt: readSeen() };
    historyStore.listeners = new Set();
    historyStore.getSnapshot = () => historyStore.snapshot;
    historyStore.subscribe = (listener) => {
      historyStore.listeners.add(listener);
      return () => {
        historyStore.listeners.delete(listener);
      };
    };
    historyStore.emit = (entries, seenAt) => {
      historyStore.snapshot = { entries: entries.slice(0, HISTORY_LIMIT), seenAt };
      for (const listener of [...historyStore.listeners]) listener();
    };
    historyStore.publish = (next) => {
      const entries = next.slice(0, HISTORY_LIMIT);
      writeHistory(entries);
      historyStore.emit(entries, historyStore.snapshot.seenAt);
    };
    historyStore.add = (result) => {
      historyStore.publish([toEntry(result), ...historyStore.snapshot.entries]);
    };
    historyStore.remove = (at) => {
      historyStore.publish(historyStore.snapshot.entries.filter((entry) => entry.at !== at));
    };
    historyStore.clear = () => {
      historyStore.publish([]);
    };
    /** Mark the whole list as seen, which clears the sidebar dot. */
    historyStore.markSeen = (at) => {
      const next = Math.max(historyStore.snapshot.seenAt, Number(at) || Date.now());
      writeSeen(next);
      historyStore.emit(historyStore.snapshot.entries, next);
    };

    /** Subscribe a component to the shared history snapshot. */
    function useHistory() {
      return React.useSyncExternalStore(historyStore.subscribe, historyStore.getSnapshot, historyStore.getSnapshot);
    }

    // ------------------------------------------------------------------- jobs

    /**
     * The running download lives outside the panel component: switching panels
     * unmounts the page, and a request owned by that unmounted component would
     * lose its progress and its result. One snapshot holds the last outcome so
     * a revisited panel shows it again, plus the query being fetched.
     *
     * A pasted list is handled here too: `batch` holds one row per entry, and
     * the entries are downloaded one at a time so a slow paper cannot hide the
     * others and no host is hit with parallel requests.
     */
    const jobStore = {};
    jobStore.snapshot = {
      busy: false, query: '', startedAt: 0, doneAt: 0, result: null, error: '',
      batch: null, stopping: false, ticket: 0,
    };
    jobStore.listeners = new Set();
    jobStore.getSnapshot = () => jobStore.snapshot;
    jobStore.subscribe = (listener) => {
      jobStore.listeners.add(listener);
      return () => {
        jobStore.listeners.delete(listener);
      };
    };
    jobStore.patch = (next) => {
      jobStore.snapshot = { ...jobStore.snapshot, ...next };
      for (const listener of [...jobStore.listeners]) listener();
    };
    jobStore.busy = () => jobStore.snapshot.busy || jobStore.snapshot.batch?.running === true;

    /**
     * Start one download. The request is module-owned, so it keeps running when
     * the panel closes and its result lands in the history either way.
     * @param text - title, DOI, arXiv id or PDF link.
     * @param options.directory - target folder.
     * @param options.email - Unpaywall contact email.
     * @returns the outcome, or null when the request failed (the error is kept).
     */
    jobStore.start = async (text, options) => {
      const query = String(text ?? '').trim();
      if (query === '' || jobStore.busy()) return null;
      // Each download gets a ticket: a late answer must never overwrite the
      // progress bar of a newer download started after it.
      const job = (jobStore.snapshot.ticket ?? 0) + 1;
      jobStore.patch({ ticket: job, busy: true, query, startedAt: Date.now(), doneAt: 0, error: '', result: null, batch: null });
      const current = () => (jobStore.snapshot.ticket ?? 0) === job;
      try {
        const outcome = await call('resolve', { query, directory: options?.directory ?? '', email: options?.email ?? '' });
        historyStore.add(outcome);
        if (current()) jobStore.patch({ busy: false, doneAt: Date.now(), result: outcome, error: '' });
        return outcome;
      } catch (failure) {
        if (current()) {
          jobStore.patch({
            busy: false,
            doneAt: Date.now(),
            error: String(failure?.message ?? failure),
          });
        }
        return null;
      }
    };

    /**
     * Run a pasted list entry by entry.
     * @param entries - `[{ query, kind }]` from the split action.
     * @param options.directory / options.email - as for one download.
     */
    jobStore.startBatch = async (entries, options) => {
      const list = Array.isArray(entries) ? entries.filter((entry) => typeof entry?.query === 'string') : [];
      if (list.length === 0 || jobStore.busy()) return;
      const rows = list.map((entry) => ({ query: entry.query, kind: entry.kind ?? 'title', status: 'pending', result: null, error: '' }));
      jobStore.patch({
        busy: false,
        batch: { rows, index: -1, running: true, startedAt: Date.now(), stopped: false },
        stopping: false,
        error: '',
        query: '',
      });
      for (const [index, row] of rows.entries()) {
        if (jobStore.snapshot.stopping) {
          jobStore.patch({ batch: { ...jobStore.snapshot.batch, running: false, stopped: true } });
          return;
        }
        jobStore.patch({ batch: { ...jobStore.snapshot.batch, index } });
        const setRow = (patch) => {
          const current = jobStore.snapshot.batch;
          const nextRows = current.rows.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
          jobStore.patch({ batch: { ...current, rows: nextRows } });
        };
        setRow({ status: 'running' });
        try {
          const outcome = await call('resolve', { query: row.query, directory: options?.directory ?? '', email: options?.email ?? '' });
          historyStore.add(outcome);
          setRow({ status: outcome.status === 'downloaded' ? 'done' : 'failed', result: outcome, error: '' });
        } catch (failure) {
          setRow({ status: 'failed', error: String(failure?.message ?? failure) });
        }
      }
      jobStore.patch({ batch: { ...jobStore.snapshot.batch, running: false } });
    };

    /** Ask the batch loop to stop after the entry in flight. */
    jobStore.stopBatch = () => {
      if (jobStore.snapshot.batch?.running !== true) return;
      jobStore.patch({ stopping: true });
    };

    /** Recognise a pasted list without downloading anything. */
    /** Where "手动搜索" sends the paper: Bing's mainland site. */
    const MANUAL_SEARCH_BASE = 'https://cn.bing.com/search?q=';

    /**
     * Open a search for one paper in the machine's own browser. The panel runs
     * inside the desktop app, so `window.open` would only open a tab there;
     * the Host route calls the OS default browser instead. If that route is
     * unavailable, a normal tab is the fallback so the button still works.
     * @param text - the paper title (or whatever identifies it).
     */
    function openManualSearch(text) {
      const q = String(text ?? '').trim();
      if (q === '') return;
      const url = `${MANUAL_SEARCH_BASE}${encodeURIComponent(q)}`;
      call('openExternal', { url })
        .catch(() => {
          window.open(url, '_blank', 'noopener,noreferrer');
        });
    }

    jobStore.split = async (text) => {
      const value = String(text ?? '');
      if (value.trim() === '') return { entries: [], truncated: false };
      try {
        const parsed = await call('split', { text: value });
        return { entries: parsed.entries ?? [], truncated: parsed.truncated === true };
      } catch {
        // Every line is still a usable query even if the Host is unavailable.
        const entries = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((query) => ({ query, kind: 'title' }));
        return { entries, truncated: false };
      }
    };

    jobStore.clear = () => {
      jobStore.patch({ busy: false, query: '', startedAt: 0, doneAt: 0, result: null, error: '', batch: null, stopping: false });
    };
    /** Show one record (typically from the history list) in the result card. */
    jobStore.show = (result) => {
      jobStore.patch({ result, error: '', batch: null });
    };
    /** Close the batch report without starting anything. */
    jobStore.dismissBatch = () => {
      if (jobStore.snapshot.batch?.running === true) return;
      jobStore.patch({ batch: null, stopping: false });
    };
    /**
     * Put away whatever the panel is showing: the result card, the error and a
     * finished batch report. History rows already hide the batch, so this only
     * matters when "Download again" is pressed from a restored record.
     */
    jobStore.dismissView = () => {
      const snapshot = jobStore.snapshot;
      if (snapshot.busy || snapshot.batch?.running === true) return;
      jobStore.patch({ result: null, error: '', batch: null, stopping: false });
    };

    /** Subscribe a component to the running download. */
    function useJob() {
      return React.useSyncExternalStore(jobStore.subscribe, jobStore.getSnapshot, jobStore.getSnapshot);
    }

    // ----------------------------------------------------------------- icons

    /** Panel glyph: a sheet with a download arrow. */
    function PanelIcon({ size }) {
      const edge = size ?? 18;
      return h('svg', {
        width: edge, height: edge, viewBox: '0 0 24 24', fill: 'none',
        'aria-hidden': 'true', focusable: 'false', stroke: 'currentColor',
        strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
        h('path', { d: 'M6 2.75h7.3L18 7.45V14' }),
        h('path', { d: 'M13 2.9V7.6h4.7' }),
        h('path', { d: 'M6 2.75v18.5h7.2' }),
        h('path', { d: 'M16.5 13.5v7.2' }),
        h('path', { d: 'M13.6 17.7l2.9 2.9 2.9-2.9' }),
      );
    }

    const svg = (children, props) => h('svg', {
      width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true',
      focusable: 'false', stroke: 'currentColor', strokeWidth: 1.7,
      strokeLinecap: 'round', strokeLinejoin: 'round', ...props,
    }, children);
    const IconSearch = () => svg([h('circle', { key: 'c', cx: 11, cy: 11, r: 6.5 }), h('path', { key: 'l', d: 'M16 16l4.5 4.5' })]);
    const IconFolder = () => svg(h('path', { d: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h8.5A1.5 1.5 0 0 1 20.5 9v8.5A1.5 1.5 0 0 1 19 19H4.5A1.5 1.5 0 0 1 3 17.5z' }));
    const IconSpinner = () => h('svg', {
      className: 'pdl-spin', width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
      'aria-hidden': 'true', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
    }, h('path', { d: 'M12 3a9 9 0 1 0 9 9', opacity: 0.9 }));
    const IconCheck = () => svg([h('circle', { key: 'c', cx: 12, cy: 12, r: 9 }), h('path', { key: 't', d: 'M8 12.3l2.6 2.7L16 9.5' })]);
    const IconAlert = () => svg([h('path', { key: 'p', d: 'M12 3.6l8.7 15.1H3.3z' }), h('path', { key: 'b', d: 'M12 9.5v4.2' }), h('path', { key: 'd', d: 'M12 16.6v.4' })]);
    const IconChevron = () => svg(h('path', { d: 'M9 6l6 6-6 6' }), { width: 14, height: 14 });
    const IconTrash = () => svg([
      h('path', { key: 'a', d: 'M4 7h16' }),
      h('path', { key: 'b', d: 'M9.5 7V4.8h5V7' }),
      h('path', { key: 'c', d: 'M6.5 7l.9 12.2h9.2L17.5 7' }),
      h('path', { key: 'd', d: 'M10.4 10.6v5.6M13.6 10.6v5.6' }),
    ], { width: 14, height: 14 });

    // ----------------------------------------------------------------- utils

    const bytesText = (value) => {
      const size = Number(value) || 0;
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
      return `${(size / 1024 / 1024).toFixed(1)} MB`;
    };

    /**
     * Where the PDF came from, as a site name. The "来源" chip describes the
     * download, never the journal, so it names the host instead of a generic
     * "publisher" label that could be mistaken for the publication.
     */
    const sourceText = (t, source, url) => {
      const host = (() => {
        try {
          return new URL(String(url ?? '')).hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })();
      if (source === 'publisher' && host !== '') return host;
      return {
        'open-access': t.sourceOpenAccess,
        'semantic-scholar': t.sourceSemantic,
        arxiv: t.sourceArxiv,
        preprint: t.sourcePreprint,
        publisher: t.sourcePublisher,
        direct: t.sourceDirect,
      }[source] ?? source ?? '';
    };

    /** One JSON call into this package's Host route. */
    async function call(endpoint, payload) {
      let response;
      try {
        response = await fetch(`${ROUTE}/${endpoint}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-dsh-paper-fetcher': '1' },
          body: JSON.stringify(payload ?? {}),
        });
      } catch (error) {
        throw new Error(String(error?.message ?? error));
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (body?.ok !== true) {
        const error = new Error(body?.error?.message ?? 'request failed');
        error.code = body?.error?.code;
        throw error;
      }
      return body.value;
    }

    // ------------------------------------------------------------ components

    /** Folder chooser: breadcrumbs plus a sub-folder list, served by the Host. */
    function FolderDialog({ t, initial, onCancel, onApply }) {
      const [listing, setListing] = React.useState(null);
      const [error, setError] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [current, setCurrent] = React.useState(initial);
      const panelRef = React.useRef(null);

      React.useEffect(() => {
        let cancelled = false;
        setBusy(true);
        call('folders', { path: current })
          .then((value) => {
            if (cancelled) return;
            setListing(value);
            setError('');
          })
          .catch((failure) => {
            if (!cancelled) setError(String(failure?.message ?? failure));
          })
          .finally(() => {
            if (!cancelled) setBusy(false);
          });
        return () => {
          cancelled = true;
        };
      }, [current]);

      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onCancel();
          }
        };
        window.addEventListener('keydown', onKey, true);
        panelRef.current?.querySelector('button')?.focus();
        return () => window.removeEventListener('keydown', onKey, true);
      }, [onCancel]);

      const here = listing?.path ?? current;
      const crumbs = Array.isArray(listing?.crumbs) ? listing.crumbs : [];
      const entries = Array.isArray(listing?.entries) ? listing.entries : [];
      return h('div', {
        className: 'pdl-overlay',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) onCancel();
        },
      }, h('div', { className: 'pdl-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.folderTitle, ref: panelRef },
        h('div', { className: 'pdl-modalTitle' }, t.folderTitle),
        h('div', { className: 'pdl-row' },
          h('button', { type: 'button', className: 'pdl-button ghost small', onClick: () => setCurrent(listing?.desktop ?? here) }, t.folderDesktop),
          h('button', { type: 'button', className: 'pdl-button ghost small', onClick: () => setCurrent(listing?.home ?? here) }, t.folderHome),
          h('button', {
            type: 'button', className: 'pdl-button ghost small',
            disabled: !listing?.parent, onClick: () => listing?.parent && setCurrent(listing.parent),
          }, t.folderUp),
          busy ? h('span', { className: 'pdl-hint' }, t.folderLoading) : null),
        h('div', { className: 'pdl-crumbs' }, crumbs.map((crumb, index) => h(React.Fragment, { key: crumb.path },
          index > 0 ? h('span', { key: 'sep' }, '/') : null,
          h('button', {
            type: 'button',
            className: index === crumbs.length - 1 ? 'pdl-crumb last' : 'pdl-crumb',
            onClick: () => setCurrent(crumb.path),
          }, crumb.name || crumb.path)))),
        error !== '' ? h('div', { className: 'pdl-error' }, error) : null,
        h('div', { className: 'pdl-folderList' }, entries.length === 0
          ? h('div', { className: 'pdl-hint', style: { padding: '8px 10px' } }, busy ? t.folderLoading : t.folderEmpty)
          : entries.map((entry) => h('button', {
            key: entry.path, type: 'button', className: 'pdl-folder',
            onClick: () => setCurrent(entry.path),
          }, h('span', { className: 'pdl-folderIcon' }, IconFolder()),
            h('span', { className: 'pdl-folderName' }, entry.name),
            h('span', { className: 'pdl-spacer' }),
            h('span', { className: 'pdl-folderIcon' }, IconChevron())))),
        h('div', { className: 'pdl-path', title: here },
          h('span', { className: 'pdl-pathIcon' }, IconFolder()),
          h('span', { className: 'pdl-pathText' }, here)),
        h('div', { className: 'pdl-modalFoot' },
          h('button', { type: 'button', className: 'pdl-button ghost', onClick: onCancel }, t.folderCancel),
          h('button', { type: 'button', className: 'pdl-button', onClick: () => onApply(here) }, t.folderApply))));
    }

    /** One live download attempt. */
    function AttemptRow({ attempt }) {
      return h('div', { className: attempt.ok ? 'pdl-attempt ok' : 'pdl-attempt fail' },
        h('span', { className: 'pdl-attemptMark' }, attempt.ok ? IconCheck() : IconAlert()),
        h('div', { className: 'pdl-attemptBody' },
          h('div', { className: 'pdl-attemptUrl' },
            h('a', { className: 'pdl-link', href: attempt.url, target: '_blank', rel: 'noreferrer noopener' }, attempt.url)),
          attempt.reason ? h('div', { className: 'pdl-attemptReason' }, attempt.reason) : null));
    }

    /**
     * Publisher platform names that must never be shown as a journal. Records
     * saved by older versions could contain one, so they are cleaned on render.
     */
    const PLATFORM_NAME = /^(springer|elsevier|wiley|taylor\s*&?\s*francis|sage|informa|acs|ieee|oxford university press|bmj|john wiley\s*&\s*sons|ltd|inc)$/i;
    const isPlatformName = (value) => {
      const text = String(value ?? '').trim();
      if (text === '') return false;
      return PLATFORM_NAME.test(text)
        || /science and business media|elsevier b\.v|^springer\b.*\b(llc|ag)\b|^informa\b/i.test(text);
    };

    /** Identifying metadata shown under a result. */
    function MetadataBlock({ t, metadata }) {
      // `id` is the translation key, stable per row; `key` alone would collide
      // when two rows share a label, and React needs a keyed Fragment here.
      const rows = [];
      if (metadata?.doi) {
        rows.push({ id: 'doi', label: t.doi, value: h('a', {
          className: 'pdl-link', href: `https://doi.org/${metadata.doi}`, target: '_blank', rel: 'noreferrer noopener',
        }, metadata.doi) });
      }
      if (metadata?.year) rows.push({ id: 'year', label: t.year, value: metadata.year });
      // Only the journal itself, in its full name: a publisher ("Springer Science
      // and Business Media LLC") is not a journal and is dropped.
      const venue = isPlatformName(metadata?.venue) ? '' : String(metadata?.venue ?? '').trim();
      if (venue !== '') rows.push({ id: 'venue', label: t.venue, value: venue });
      if (Array.isArray(metadata?.authors) && metadata.authors.length > 0) {
        rows.push({
          id: 'authors',
          label: t.authors,
          value: metadata.authors.slice(0, 12).join(', ') + (metadata.authors.length > 12 ? ' …' : ''),
        });
      }
      if (rows.length === 0) return null;
      return h('div', { className: 'pdl-metaGrid' }, rows.map((row) => h(React.Fragment, { key: row.id },
        h('div', { className: 'pdl-metaKey' }, row.label),
        h('div', { className: 'pdl-metaValue' }, row.value))));
    }

    /** Result card for a live search or a restored history entry. */
    function ResultCard({ t, result, onAgain }) {
      const [showAbstract, setShowAbstract] = React.useState(false);
      const [showAttempts, setShowAttempts] = React.useState(false);
      const ok = result.status === 'downloaded';
      const restored = result.restored === true;
      // Where "open folder" would send the OS: the saved file, else its folder.
      // A record from an older build may carry neither, so the button is only
      // rendered when there is somewhere to go.
      const revealTarget = String(result.file?.path ?? '').trim()
        || String(result.directory ?? '').trim();
      const abstract = typeof result.metadata?.abstract === 'string' ? result.metadata.abstract.trim() : '';
      const tried = Array.isArray(result.tried) ? result.tried : [];
      const manual = Array.isArray(result.manual) ? result.manual : [];
      const alternatives = Array.isArray(result.alternatives) ? result.alternatives : [];
      return h('div', { className: 'pdl-card' },
        restored
          ? h('div', { className: 'pdl-row' },
            h('span', { className: ok ? 'pdl-chip ok' : 'pdl-chip warn' }, ok ? t.statusOk : t.statusFail),
            h('span', { className: 'pdl-chip' }, new Date(Number(result.at) || Date.now()).toLocaleString()),
            h('span', { className: 'pdl-spacer' }),
            h('span', { className: 'pdl-hint' }, t.historyLoaded))
          : null,
        h('div', { className: ok ? 'pdl-status ok' : 'pdl-status fail' },
          h('span', { className: 'pdl-statusIcon' }, ok ? IconCheck() : IconAlert()),
          h('div', { style: { minWidth: 0, flex: 1 } },
            h('div', { className: 'pdl-fileName' }, ok ? (result.file?.name ?? '') : t.failedTitle),
            ok
              ? h('div', { className: 'pdl-filePath' }, result.file?.path ?? '')
              : h('div', { className: 'pdl-filePath' }, result.message || t.failedHint),
            !ok && result.query ? h('div', { className: 'pdl-filePath' }, result.query) : null,
            ok ? h('div', { className: 'pdl-row', style: { marginTop: 6 } },
              result.file?.source ? h('span', { className: 'pdl-chip ok' }, `${t.source} · ${sourceText(t, result.file.source)}`) : null,
              result.file?.bytes ? h('span', { className: 'pdl-chip' }, `${t.fileSize} ${bytesText(result.file.bytes)}`) : null,
              typeof result.elapsedMs === 'number' && result.elapsedMs > 0
                ? h('span', { className: 'pdl-chip' }, `${t.elapsed} ${(result.elapsedMs / 1000).toFixed(1)} s`)
                : null) : null)),
        h('div', { className: 'pdl-row' },
          // A restored record still names a file on disk, so opening its folder
          // is just as useful there as right after the download.
          ok && revealTarget !== '' ? h('button', {
            type: 'button', className: 'pdl-button ghost small',
            onClick: () => {
              call('reveal', { path: revealTarget }).catch(() => {});
            },
          }, t.openFolder) : null,
          h('button', { type: 'button', className: 'pdl-button ghost small', onClick: onAgain }, t.downloadAgain),
          // A failed lookup means the paper was not on disk: hand it to the
          // user's own browser for a manual search.
          !ok ? h('button', {
            type: 'button', className: 'pdl-button ghost small', title: t.manualSearchHint,
            onClick: () => openManualSearch(result.metadata?.title || result.query),
          }, t.manualSearch) : null),
        h(MetadataBlock, { t, metadata: result.metadata }),
        abstract !== ''
          ? h('div', null,
            h('button', {
              type: 'button', className: 'pdl-crumb', style: { padding: 0, color: 'var(--dsw-alias-brand-primary)' },
              onClick: () => setShowAbstract((value) => !value),
            }, showAbstract ? t.hideAbstract : t.showAbstract),
            showAbstract ? h('div', { className: 'pdl-hint pdl-abstractWhite', style: { marginTop: 6 } }, abstract) : null)
          : null,
        manual.length > 0 && !ok
          ? h('div', { className: 'pdl-field' },
            h('div', { className: 'pdl-sectionTitle' }, t.manual),
            h('div', { className: 'pdl-list' }, manual.map((item) => h('div', { key: item.url, className: 'pdl-attempt' },
              h('span', { className: 'pdl-attemptMark' }, IconChevron()),
              h('div', { className: 'pdl-attemptBody' },
                h('a', { className: 'pdl-link', href: item.url, target: '_blank', rel: 'noreferrer noopener' }, item.label ?? item.url))))))
          : null,
        alternatives.length > 0
          ? h('div', { className: 'pdl-field' },
            h('div', { className: 'pdl-sectionTitle' }, t.alternatives),
            h('div', { className: 'pdl-list' }, alternatives.map((row) => h('div', {
              key: `${row.doi}|${row.title}`, className: 'pdl-attemptBody',
            },
              h('div', { className: 'pdl-attemptUrl' },
                row.doi
                  ? h('a', { className: 'pdl-link', href: `https://doi.org/${row.doi}`, target: '_blank', rel: 'noreferrer noopener' }, row.title)
                  : row.title),
              h('div', { className: 'pdl-attemptReason' }, [row.year, row.venue, row.doi].filter(Boolean).join(' · '))))))
          : null,
        tried.length > 0
          ? h('div', { className: 'pdl-field' },
            h('button', {
              type: 'button', className: 'pdl-crumb', style: { padding: 0 },
              onClick: () => setShowAttempts((value) => !value),
            }, `${t.tried} · ${String(t.attempts ?? '{n}').replace('{n}', String(tried.length))}`),
            showAttempts
              ? h('div', { className: 'pdl-list', style: { marginTop: 6 } },
                tried.map((attempt, index) => h(AttemptRow, { key: `${attempt.url}-${index}`, attempt })))
              : null)
          : null);
    }

    /**
     * Keeps one broken card from blanking the whole panel: a malformed record
     * shows a short notice instead, and the rest of the page still renders.
     */
    class ResultBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }

      static getDerivedStateFromError() {
        return { failed: true };
      }

      componentDidCatch(error) {
        console.error('[paper-download] result card failed to render', error);
      }

      render() {
        if (this.state.failed) {
          return h('div', { className: 'pdl-error' }, this.props.notice);
        }
        return this.props.children;
      }
    }

    /** Most rows the query box grows to; beyond this it scrolls. */
    const QUERY_MAX_ROWS = 10;
    /** Roughly how many characters fit on one row of the panel's query box. */
    const QUERY_ROW_CHARS = 52;
    /** Row height used to turn a pixel measurement into a row count. */
    const QUERY_LINE_HEIGHT = 20;

    /**
     * Rows the query box needs for its current text.
     * Each explicit line counts, and a long line that wraps to the box width
     * counts once more per wrapped row, so pasted text is fully visible.
     * @param text - current input value.
     * @returns 1…QUERY_MAX_ROWS.
     */
    function lineCount(text) {
      const lines = String(text ?? '').split('\n');
      const rows = lines.reduce((total, line) => total + Math.max(1, Math.ceil(line.length / QUERY_ROW_CHARS)), 0);
      return Math.max(1, Math.min(QUERY_MAX_ROWS, rows));
    }

    /**
     * Size the query box to its content, up to QUERY_MAX_ROWS rows.
     * Measuring the real scroll height follows wrapping exactly; the CSS
     * max-height keeps the panel from being pushed down past ten rows.
     * @param element - the textarea that received the edit.
     */
    function autoSize(element) {
      if (element === null || element === undefined || typeof element.style === 'undefined') return;
      const maxHeight = QUERY_MAX_ROWS * QUERY_LINE_HEIGHT + 20;
      element.style.height = 'auto';
      const needed = Math.min(element.scrollHeight ?? 0, maxHeight);
      element.style.height = `${Math.max(QUERY_LINE_HEIGHT + 20, needed)}px`;
      element.style.overflowY = (element.scrollHeight ?? 0) > maxHeight ? 'auto' : 'hidden';
    }

    /**
     * Progress and outcome of a pasted list. Rows are shown in input order so a
     * reader can follow along, and each finished row can be opened in the result
     * card above.
     */
    function BatchReport({ t, batch, stopping, onOpen, onStop, onDismiss }) {
      const rows = Array.isArray(batch?.rows) ? batch.rows : [];
      const done = rows.filter((row) => row.status === 'done').length;
      const failed = rows.filter((row) => row.status === 'failed').length;
      const settled = done + failed;
      const running = batch?.running === true;
      const current = running && batch.index >= 0 ? rows[batch.index] : null;
      return h('div', { className: 'pdl-card' },
        h('div', { className: 'pdl-row' },
          h('span', { className: running ? 'pdl-chip' : 'pdl-chip ok' }, running ? t.batchRunning : t.batchDone),
          h('span', { className: 'pdl-historyMeta' },
            t.batchProgress.replace('{done}', String(settled)).replace('{total}', String(rows.length))),
          done > 0 ? h('span', { className: 'pdl-chip ok' }, `${t.batchOk} ${done}`) : null,
          failed > 0 ? h('span', { className: 'pdl-chip warn' }, `${t.batchFail} ${failed}`) : null,
          h('span', { className: 'pdl-spacer' }),
          running
            ? h('button', { type: 'button', className: 'pdl-button ghost small', onClick: onStop, disabled: stopping === true },
              stopping === true ? t.batchStopping : t.batchStop)
            : h('button', { type: 'button', className: 'pdl-button ghost small', onClick: onDismiss }, t.batchClose)),
        current !== null
          ? h('div', { className: 'pdl-status' },
            h('span', { className: 'pdl-statusIcon' }, IconSpinner()),
            h('div', { style: { minWidth: 0, flex: 1 } },
              h('div', { className: 'pdl-filePath' }, current.query),
              h('div', { className: 'pdl-filePath' }, t.batchWaiting)))
          : null,
        h('div', { className: 'pdl-list' }, rows.map((row, index) => {
          const name = resolveName(row.result?.metadata, row.query, row.result?.file ?? null);
          const reason = row.status === 'failed'
            ? (row.error || row.result?.message || t.failedHint)
            : '';
          return h('div', { key: `${index}-${row.query}`, className: 'pdl-historyRecord' },
            h('button', {
              type: 'button',
              className: 'pdl-historyRow',
              onClick: row.result ? () => onOpen(row.result) : undefined,
              disabled: row.result === null || row.result === undefined,
              title: name,
            },
              h('span', { className: `pdl-dot ${row.status === 'done' ? 'ok' : row.status === 'failed' ? 'fail' : ''}`, 'aria-hidden': 'true' }),
              h('span', { className: 'pdl-historyMain' },
                h('span', { className: 'pdl-historyName' }, name),
                h('span', { className: 'pdl-historyMeta' },
                  row.status === 'pending' ? t.batchWaiting
                    : row.status === 'running' ? t.batchItemRunning
                      : row.status === 'done' ? t.statusOk
                        : reason)),
              h('span', { className: 'pdl-historyMeta' }, `${index + 1}`)));
        })));
    }

    /** One persisted record: open it in the card above, or remove it. */
    function HistoryRow({ t, entry, onOpen, onRemove }) {
      const ok = entry.status === 'downloaded';
      // The name the file is (or would have been) saved under: `buildFileName`
      // for both outcomes, falling back to the stored title for old records.
      const name = resolveName(entry.metadata, entry.query, ok ? entry.file : null);
      const path = ok ? String(entry.file?.path ?? '') : String(entry.plannedPath ?? '');
      const when = new Date(Number(entry.at) || Date.now());
      return h('div', { className: 'pdl-historyRecord' },
        h('button', { type: 'button', className: 'pdl-historyRow', onClick: onOpen, title: path !== '' ? path : name },
          h('span', { className: ok ? 'pdl-dot ok' : 'pdl-dot fail', 'aria-hidden': 'true' }),
          h('span', { className: 'pdl-historyMain' },
            h('span', { className: 'pdl-historyName' }, name),
            h('span', { className: 'pdl-historySub' }, ok
              ? [t.statusOk, when.toLocaleString(), entry.file?.bytes ? bytesText(entry.file.bytes) : ''].filter(Boolean).join(' · ')
              : [t.statusFail, when.toLocaleString(), t.notSaved].join(' · ')))),
        h('button', {
          type: 'button', className: 'pdl-iconButton', title: t.removeEntry, 'aria-label': t.removeEntry,
          onClick: (event) => {
            event.stopPropagation();
            onRemove();
          },
        }, IconTrash()));
    }

    /** Turn one stored record back into the card's shape. */
    function entryResult(entry) {
      return {
        restored: true,
        at: entry.at,
        query: entry.query,
        status: entry.status,
        directory: entry.directory ?? '',
        file: entry.file ?? null,
        metadata: entry.metadata ?? {},
        tried: [],
        alternatives: [],
        manual: [],
        message: entry.message ?? '',
      };
    }

    /**
     * Resolve the copy once, accepting either shape the host may pass: a bound
     * lookup function (`t('doi')`) or a plain dictionary (`t.doi`).
     * The result is callable *and* carries every key, because this panel uses
     * both `tr('title')` and `tr.doi`; an unknown key falls back to Chinese.
     */
    function resolveCopy(t) {
      const source = typeof t === 'function'
        ? Object.fromEntries(Object.keys(ZH).map((key) => [key, t(key)]))
        : t !== null && typeof t === 'object' ? t : {};
      const dictionary = { ...ZH, ...source };
      const lookup = (key, params) => {
        const text = typeof dictionary[key] === 'string' ? dictionary[key] : key;
        return params ? text.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match)) : text;
      };
      return Object.assign(lookup, dictionary);
    }

    /** The panel page registered into `main`. */
    function PaperDownloadPanel(props) {
      const tr = resolveCopy(props?.t);
      const [directory, setDirectory] = React.useState(() => readLocal(DIRECTORY_KEY));
      const [email, setEmail] = React.useState(() => readLocal(EMAIL_KEY));
      const [query, setQuery] = React.useState('');
      const [pickerOpen, setPickerOpen] = React.useState(false);
      const inputRef = React.useRef(null);
      const snapshot = useHistory();
      const history = snapshot.entries;
      // Owned by the module, not this component: closing the panel mid-download
      // and coming back shows the same progress bar, and a finished download is
      // still here when you return.
      const job = useJob();
      const { busy, result, error } = job;
      const batch = job.batch ?? null;
      // The panel is "working" for either kind of job; controls disable together.
      const working = busy || batch?.running === true;

      // Viewing the panel counts as reading the records: the sidebar dot goes away.
      React.useEffect(() => {
        const newest = history.reduce((max, entry) => Math.max(max, entry.at), 0);
        if (newest > snapshot.seenAt) historyStore.markSeen(newest);
      });

      // Ask the Host for the default (Desktop) path the first time.
      React.useEffect(() => {
        if (directory !== '') return undefined;
        let cancelled = false;
        call('folders', { path: '' })
          .then((value) => {
            if (!cancelled && typeof value?.desktop === 'string') setDirectory(value.desktop);
          })
          .catch(() => {});
        return () => {
          cancelled = true;
        };
      }, [directory]);

      React.useEffect(() => {
        inputRef.current?.focus();
      }, []);

      // Re-fit the box on mount and whenever the text changes from outside an
      // edit (batch fill, history replay): the row count alone cannot account
      // for real wrapping once the panel width is known.
      React.useEffect(() => {
        autoSize(inputRef.current);
      }, [query]);

      // Another tab may add, clear or read the records; mirror all of it here.
      React.useEffect(() => {
        const onStorage = (event) => {
          if (event.key === null || event.key === HISTORY_KEY) historyStore.publish(readHistory());
          else if (event.key === UNREAD_KEY) historyStore.markSeen(readSeen());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
      }, []);

      const start = (text) => {
        const value = String(text ?? '').trim();
        if (value === '' || jobStore.snapshot.busy) return;
        // A download keeps running off-panel, so restore any view state it needs.
        if (value !== query) setQuery(value);
        // Pressed from a restored record: clear that card so the progress bar
        // is the first thing shown, then run the new search.
        jobStore.dismissView();
        jobStore.start(value, { directory, email }).finally(() => {
          inputRef.current?.focus();
        });
      };

      // Read the input's current value instead of relying on the render closure:
      // after leaving and returning to the panel the closure can lag one keystroke.
      // A pasted list (two or more recognised entries) switches to batch mode.
      const submitCurrent = (event) => {
        if (event !== undefined && typeof event.preventDefault === 'function') event.preventDefault();
        const typed = inputRef.current?.value;
        const value = typeof typed === 'string' && typed.trim() !== '' ? typed : query;
        submitValue(value);
      };

      const submitValue = (value) => {
        const text = String(value ?? '').trim();
        if (text === '' || jobStore.busy()) return;
        if (text !== query) setQuery(text);
        // One entry behaves exactly like before; several become a batch.
        if (!/[\r\n]/.test(text)) {
          jobStore.start(text, { directory, email }).finally(() => {
            inputRef.current?.focus();
          });
          return;
        }
        jobStore.split(text).then(({ entries }) => {
          if (entries.length <= 1) {
            jobStore.start(entries[0]?.query ?? text, { directory, email }).finally(() => {
              inputRef.current?.focus();
            });
            return;
          }
          jobStore.startBatch(entries, { directory, email });
        });
      };

      // The bar animates while the module-owned request is out; a tick keeps the
      // elapsed time moving without re-rendering on every frame.
      const [, setTick] = React.useState(0);
      React.useEffect(() => {
        if (!busy) return undefined;
        const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
        return () => window.clearInterval(timer);
      }, [busy]);

      const elapsedSeconds = busy && job.startedAt > 0 ? Math.max(0, Math.floor((Date.now() - job.startedAt) / 1000)) : 0;
      const statusLine = busy
        ? h('div', { className: 'pdl-status' },
          h('span', { className: 'pdl-statusIcon' }, IconSpinner()),
          h('div', { style: { minWidth: 0, flex: 1 } },
            h('div', { className: 'pdl-row' },
              h('span', { style: { fontWeight: 600 } }, tr('searching')),
              h('span', { className: 'pdl-spacer' }),
              h('span', { className: 'pdl-historyMeta' }, tr('elapsedRunning').replace('{n}', String(elapsedSeconds)))),
            job.query !== '' ? h('div', { className: 'pdl-filePath' }, job.query) : null,
            h('div', { className: 'pdl-filePath' }, tr('searchingHint')),
            h('div', { className: 'pdl-filePath' }, tr('searchingBackground'))))
        : null;

      return h('div', { className: 'pdl-page' },
        h('div', { className: 'pdl-inner' },
          h('div', { className: 'pdl-head' },
            h('div', { className: 'pdl-head-mark' }, PanelIcon({ size: 20 })),
            h('div', null,
              h('h1', { className: 'pdl-title' }, tr('title')),
              h('p', { className: 'pdl-sub' }, tr('subtitle')))),
          h('form', {
            className: 'pdl-card',
            role: 'search',
            onSubmit: submitCurrent,
          },
            h('div', { className: 'pdl-field' },
              h('div', { className: 'pdl-searchRow' },
                // A textarea rather than an input: pasting a reference list is a
                // first-class case, and Enter still submits (Shift+Enter breaks
                // the line so a long list can be edited).
                h('textarea', {
                  id: 'pdl-query',
                  ref: inputRef,
                  className: 'pdl-input pdl-queryBox',
                  rows: lineCount(query),
                  autoComplete: 'off',
                  spellCheck: false,
                  placeholder: tr('placeholder'),
                  value: query,
                  disabled: working,
                  onChange: (event) => {
                    setQuery(event.target.value);
                    autoSize(event.target);
                  },
                  onInput: (event) => autoSize(event.target),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
                      event.preventDefault();
                      submitValue(inputRef.current?.value ?? query);
                    }
                  },
                }),
                h('button', {
                  type: 'submit', className: 'pdl-button', title: tr('searchHint'),
                  disabled: working || query.trim() === '',
                }, working ? IconSpinner() : IconSearch(), tr('search')))),
            query.includes('\n')
              ? h('div', { className: 'pdl-hint' }, tr('batchHint'))
              : null,
            h('div', { className: 'pdl-field' },
              h('label', { className: 'pdl-label' }, tr('directory')),
              h('div', { className: 'pdl-pathRow' },
                h('div', { className: 'pdl-path', title: directory },
                  h('span', { className: 'pdl-pathIcon' }, IconFolder()),
                  h('span', { className: 'pdl-pathText' }, directory === '' ? '…' : directory)),
                h('button', {
                  type: 'button', className: 'pdl-button ghost', disabled: working,
                  onClick: () => setPickerOpen(true),
                }, IconFolder(), tr('pickFolder')))),
            h('div', { className: 'pdl-field' },
              h('label', { className: 'pdl-label', htmlFor: 'pdl-email' }, tr('email')),
              h('div', { className: 'pdl-path' },
                h('input', {
                  id: 'pdl-email',
                  className: 'pdl-pathText',
                  type: 'email',
                  autoComplete: 'off',
                  spellCheck: false,
                  placeholder: tr('emailPlaceholder'),
                  value: email,
                  disabled: working,
                  onChange: (event) => {
                    setEmail(event.target.value);
                    writeLocal(EMAIL_KEY, event.target.value.trim());
                  },
                }),
              ))),
          statusLine,
          error !== '' ? h('div', { className: 'pdl-error' }, `${tr('errorTitle')}: ${error}`) : null,
          result !== null
            ? h(ResultBoundary, { notice: tr('resultBroken') },
              h(ResultCard, {
                t: tr,
                result,
                onAgain: () => {
                  start(result.query);
                },
              }))
            : null,
          batch !== null
            ? h(BatchReport, {
              t: tr,
              batch,
              stopping: job.stopping === true,
              onOpen: (outcome) => jobStore.show(outcome),
              onStop: () => jobStore.stopBatch(),
              onDismiss: () => jobStore.dismissBatch(),
            })
            : null,
          h('div', { className: 'pdl-field' },
            h('div', { className: 'pdl-sectionHead' },
              h('span', { className: 'pdl-sectionTitle' }, tr('lastResults')),
              history.length > 0
                ? h('span', { className: 'pdl-historyMeta' }, tr('historyCount').replace('{n}', String(history.length)))
                : null,
              h('span', { className: 'pdl-spacer' }),
              history.length > 0
                ? h('button', { type: 'button', className: 'pdl-crumb', onClick: () => historyStore.clear() }, tr('clearHistory'))
                : null),
            history.length === 0
              ? h('div', { className: 'pdl-hint' }, tr('historyEmptyHint'))
              : h('div', { className: 'pdl-historyList' }, history.map((entry) => h(HistoryRow, {
                key: `${entry.at}-${entry.query}`,
                t: tr,
                entry,
                onOpen: () => jobStore.show(entryResult(entry)),
                onRemove: () => historyStore.remove(entry.at),
              })))),
          pickerOpen
            ? h(FolderDialog, {
              t: tr,
              initial: directory,
              onCancel: () => setPickerOpen(false),
              onApply: (value) => {
                setDirectory(value);
                writeLocal(DIRECTORY_KEY, value);
                setPickerOpen(false);
              },
            })
            : null));
    }

    /**
     * Sidebar launcher: the panel glyph plus a small dot. The dot is a plain
     * 7px circle with no number:
     *  - pulsing while a download is running,
     *  - steady while there are records never looked at (seen when the panel is
     *    opened, so it disappears on viewing).
     * The sidebar row itself owns hover/active styling and the click target.
     */
    function SidebarLauncher(props) {
      const size = typeof props?.size === 'number' ? props.size : 18;
      const label = typeof props?.label === 'string' && props.label !== '' ? props.label : ZH.panel;
      const { entries, seenAt } = useHistory();
      const job = useJob();
      const unread = entries.filter((entry) => entry.at > seenAt).length;
      const latest = entries[0];
      const state = job.busy ? 'running' : unread > 0 ? 'unread' : '';
      const title = job.busy
        ? `${label} · ${ZH.searching}`
        : latest === undefined
          ? label
          : `${label} · ${latest.file?.name ?? latest.metadata?.title ?? latest.query}`;
      return h('span', {
        className: 'pdl-launcher',
        style: { width: size, height: size },
        title,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof props?.onOpen === 'function') props.onOpen();
        },
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (typeof props?.onOpen === 'function') props.onOpen();
          }
        },
      },
        PanelIcon({ size }),
        state === ''
          ? null
          : h('span', {
            className: state === 'running' ? 'pdl-dot-mark running' : 'pdl-dot-mark',
            'aria-label': state === 'running' ? `${label}: ${unread} unread` : `${label}: ${ZH.historyCount.replace('{n}', String(unread))}`,
          }, null));
    }

    // ---------------------------------------------------------------- plugin

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const locale = ctx.locale;
        ctx.effect(() => locale.register('paperDownload', { zh: ZH, en: EN }), 'paper-download: dictionaries');
        const t = locale.bind('paperDownload');
        ctx.effect(installStyles, 'paper-download: styles');

        // Open the panel. Selection is independent of the current Session.
        const open = () => {
          try {
            ctx.get('layout')?.selectPanel(PANEL_ID);
          } catch {
            // The main panel is not registered yet; nothing to select.
          }
        };

        // Sidebar icon. `order: 22` sits right under the shipped entries
        // (Plugins 0, Schedules 10, "自动化" entry customization 20) and above
        // session import (40).
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 22,
          label: () => t('panel'),
          inject: () => ({ onOpen: open, label: t('panel') }),
        }, SidebarLauncher));

        // The page itself.
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: 'paperDownload',
        }, PaperDownloadPanel));
      },
    };
  },
});
