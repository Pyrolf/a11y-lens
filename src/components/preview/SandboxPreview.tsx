import { useEffect, useMemo, useRef, useState } from 'react';
// Import the published browser build verbatim. Vite rewrites the UMD wrapper
// in `axe.source` when it minifies the imported module, which breaks the
// injected source in production; ?raw keeps it byte-for-byte intact.
import axeSource from 'axe-core/axe.min.js?raw';
import type {
  AxeResultsPayload,
  AxeRuleReport,
  AxeViolationReport,
  ComputedStyleEntry,
} from '../../types/audit';
import type { PreviewViewport } from '../../types/workspace';
import { buildSandboxFallbackCss } from '../../utils/styleResolver';

interface SandboxPreviewProps {
  html: string;
  viewport: PreviewViewport;
  title: string;
  issueCount?: number;
  onComputedStyles: (styles: ComputedStyleEntry[], html: string) => void;
  onAxeResults: (results: AxeResultsPayload, html: string) => void;
}

const VIEWPORT_CONFIG: Record<
  PreviewViewport,
  { label: string; frameClassName: string }
> = {
  desktop: {
    label: 'Desktop · Full width',
    frameClassName: 'w-full',
  },
  tablet: {
    label: 'Tablet · 768px',
    frameClassName: 'w-full max-w-[768px] rounded-xl border border-slate-700 shadow-lg',
  },
  mobile: {
    label: 'Mobile · 375px',
    frameClassName: 'w-full max-w-[375px] rounded-2xl border border-slate-700 shadow-lg',
  },
};

const MIN_PREVIEW_HEIGHT = 160;
const MAX_PREVIEW_HEIGHT = 480;

function clampPreviewHeight(height: number): number {
  if (!Number.isFinite(height)) return MIN_PREVIEW_HEIGHT;
  return Math.min(MAX_PREVIEW_HEIGHT, Math.max(MIN_PREVIEW_HEIGHT, Math.round(height)));
}

/**
 * The deterministic utility CSS is appended after the Tailwind CDN output so
 * computed styles are available even when the CDN cannot be reached.
 */
const FALLBACK_CSS = buildSandboxFallbackCss();

/**
 * The axe source is embedded in an inline script in the iframe srcDoc. Escape
 * every `<` as `\u003c` in the JS string literal so any `</script>` sequence in
 * the minified distribution cannot close the containing HTML script tag early.
 * The source is injected via `script.textContent` instead of raw interpolation.
 */
const AXE_SOURCE_LITERAL = JSON.stringify(axeSource).replace(/</g, '\\u003c');

function buildSrcDoc(html: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style data-a11y-lens-sandbox>
      html, body { margin: 0; background: #0f172a; }
      body { padding: 0; }
    </style>
    <script data-a11y-lens-fallback-loader>
      (function () {
        var style = document.createElement('style');
        style.setAttribute('data-a11y-lens-fallback', '');
        style.textContent = ${JSON.stringify(FALLBACK_CSS)};
        document.head.appendChild(style);
      })();
    </script>
  </head>
  <body>
    ${html}
    <script data-a11y-lens-axe-loader>
      (function () {
        var AXE_SOURCE = ${AXE_SOURCE_LITERAL};
        var axeScript = document.createElement('script');
        axeScript.setAttribute('data-a11y-lens-axe-source', '');
        axeScript.textContent = AXE_SOURCE;
        document.head.appendChild(axeScript);
      })();
    </script>
    <script data-a11y-lens-probe>
      (function () {
        var props = ['color', 'background-color', 'font-size', 'font-weight', 'font-family', 'border-radius', 'padding', 'outline-style', 'outline-width'];
        function isVisibleColor(value) {
          if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return false;
          return !/^rgba\\([^)]*,\\s*0\\s*\\)$/.test(value);
        }
        function effectiveBackground(element) {
          var node = element;
          while (node && node.nodeType === 1) {
            var computed = window.getComputedStyle(node);
            var background = computed.getPropertyValue('background-color') || computed.getPropertyValue('background');
            if (isVisibleColor(background)) return background;
            node = node.parentElement;
          }
          return 'rgb(255, 255, 255)';
        }
        function postStyles(entries) {
          parent.postMessage(
            {
              source: 'a11y-lens-sandbox',
              type: 'computed-styles',
              styles: entries,
              height: document.body.scrollHeight
            },
            '*'
          );
        }
        function truncate(text, maxLength) {
          var normalized = String(text || '').replace(/\\s+/g, ' ').trim();
          return normalized.length > maxLength ? normalized.slice(0, maxLength - 1) + '…' : normalized;
        }
        function cssEscape(value) {
          return String(value).replace(/[^a-zA-Z0-9_-]/g, function (ch) { return '\\\\' + ch; });
        }
        function selectorFor(element) {
          if (!element || element.nodeType !== 1) return '';
          var tag = element.tagName.toLowerCase();
          var selector = tag;
          if (element.id) {
            selector += '#' + cssEscape(element.id);
          } else if (typeof element.className === 'string' && element.className.trim()) {
            var classes = element.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2).map(cssEscape);
            if (classes.length) selector += '.' + classes.join('.');
          }
          var parent = element.parentElement;
          if (parent) {
            var siblings = Array.prototype.filter.call(parent.children, function (sibling) {
              return sibling.tagName === element.tagName;
            });
            if (siblings.length > 1) selector += ':nth-of-type(' + (siblings.indexOf(element) + 1) + ')';
          }
          return selector;
        }
        function wcagFromTags(tags) {
          var criterion = '';
          var level = 'Unknown';
          for (var i = 0; i < tags.length; i++) {
            var tag = String(tags[i] || '');
            var wcagMatch = /^wcag(\\d)(\\d)(\\d+)$/.exec(tag);
            if (wcagMatch) criterion = wcagMatch[1] + '.' + wcagMatch[2] + '.' + wcagMatch[3];
            var levelMatch = /^wcag\\d+(aaa|aa|a)$/.exec(tag);
            if (levelMatch) level = levelMatch[1].toUpperCase();
          }
          return { criterion: criterion, level: level };
        }
        function serializeAxeRule(rule) {
          var tags = Array.isArray(rule.tags) ? rule.tags : [];
          var wcag = wcagFromTags(tags);
          return {
            ruleId: rule.id,
            description: rule.description || '',
            help: rule.help || '',
            helpUrl: rule.helpUrl || '',
            wcagTags: tags.filter(function (tag) { return /^wcag/.test(tag) || /^best-practice$/.test(tag); }),
            wcagCriterion: wcag.criterion,
            wcagLevel: wcag.level
          };
        }
        function postAxeResults(violations, passes) {
          parent.postMessage(
            {
              source: 'a11y-lens-sandbox',
              type: 'axe-results',
              violations: violations,
              passes: passes
            },
            '*'
          );
        }
        function runAxe() {
          if (!window.axe || typeof window.axe.run !== 'function') {
            postAxeResults([], []);
            return;
          }
          try {
            window.axe.run(
              document.body,
              {
                runOnly: {
                  type: 'tag',
                  values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']
                }
              }
            ).then(function (results) {
              var violations = (results && results.violations ? results.violations : []).map(function (violation) {
                var serialized = serializeAxeRule(violation);
                serialized.impact = violation.impact || null;
                serialized.nodes = (violation.nodes || []).map(function (node) {
                  var target = Array.isArray(node.target) ? node.target[0] : '';
                  var element = null;
                  try {
                    if (typeof target === 'string') element = document.querySelector(target);
                    else if (Array.isArray(target)) element = document.querySelector(target.join(' '));
                  } catch (e) {}
                  var selector = element ? selectorFor(element) : (typeof target === 'string' ? target : 'unknown');
                  return {
                    selector: selector || 'unknown',
                    snippet: truncate(node.html || (element ? element.outerHTML : ''), 180)
                  };
                });
                return serialized;
              });
              var passes = (results && results.passes ? results.passes : []).map(serializeAxeRule);
              postAxeResults(violations, passes);
            }).catch(function () {
              postAxeResults([], []);
            });
          } catch (e) {
            postAxeResults([], []);
          }
        }
        function snapshot() {
          var entries = [];
          var elements = document.body.querySelectorAll('*');
          for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            var tag = element.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style' || tag === 'template') continue;
            var computed = window.getComputedStyle(element);
            var styles = {};
            for (var p = 0; p < props.length; p++) styles[props[p]] = computed.getPropertyValue(props[p]);
            var text = '';
            for (var c = 0; c < element.childNodes.length; c++) {
              if (element.childNodes[c].nodeType === 3) text += element.childNodes[c].nodeValue || '';
            }
            var selector = selectorFor(element);
            entries.push({
              tag: tag,
              id: element.id || undefined,
              className: element.getAttribute('class') || '',
              text: text.replace(/\\s+/g, ' ').trim(),
              selector: selector,
              outerHTML: element.outerHTML.slice(0, 300),
              styles: styles,
              effectiveBackground: effectiveBackground(element)
            });
          }
          postStyles(entries);
          runAxe();
        }
        if (document.readyState === 'complete') snapshot();
        else window.addEventListener('load', snapshot);
        window.addEventListener('load', function () { window.setTimeout(snapshot, 120); });

        // Reflows from viewport switches and late-loading images/fonts change
        // the content height without reloading the frame, so re-measure on resize.
        if (typeof ResizeObserver !== 'undefined') {
          var lastHeight = 0;
          new ResizeObserver(function () {
            var height = document.body.scrollHeight;
            if (height === lastHeight) return;
            lastHeight = height;
            snapshot();
          }).observe(document.body);
        }

        // The parent asks for an explicit measurement when viewport mode changes.
        window.addEventListener('message', function (event) {
          if (event.source !== parent) return;
          var request = event.data;
          if (!request || request.source !== 'a11y-lens' || request.type !== 'measure') return;
          snapshot();
        });
      })();
    </script>
  </body>
</html>`;
}

/**
 * The iframe uses an opaque origin (`sandbox="allow-scripts"` without
 * `allow-same-origin`), so its real `contentDocument` is intentionally never
 * read. Computed styles arrive via the validated postMessage probe instead.
 */
export function SandboxPreview({
  html,
  viewport,
  title,
  issueCount,
  onComputedStyles,
  onAxeResults,
}: SandboxPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastSnapshotRef = useRef('');
  const lastAxeSignatureRef = useRef('');
  const srcDoc = useMemo(() => buildSrcDoc(html), [html]);
  // Track which document a measurement belongs to so a new snippet starts at
  // the minimum height instead of inheriting the previous snippet's frame size.
  const [heightState, setHeightState] = useState({ srcDoc, height: MIN_PREVIEW_HEIGHT });
  const contentHeight = heightState.srcDoc === srcDoc ? heightState.height : MIN_PREVIEW_HEIGHT;

  // A reloaded frame must be allowed to report even if its snapshots match the
  // previous snippet, so reset both dedupe signatures when srcDoc changes.
  useEffect(() => {
    lastSnapshotRef.current = '';
    lastAxeSignatureRef.current = '';
  }, [srcDoc]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            source?: string;
            type?: string;
            styles?: ComputedStyleEntry[];
            violations?: AxeViolationReport[];
            passes?: AxeRuleReport[];
            height?: number;
          }
        | null;
      if (!data || data.source !== 'a11y-lens-sandbox') return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (data.type === 'computed-styles') {
        if (typeof data.height === 'number') {
          setHeightState({ srcDoc, height: clampPreviewHeight(data.height) });
        }
        const styles = Array.isArray(data.styles) ? data.styles : [];
        // The probe posts at load, again 120ms later to catch late Tailwind
        // styles, and on reflow. Ignore identical snapshots so the audit runs once.
        const signature = JSON.stringify(styles);
        if (signature === lastSnapshotRef.current) return;
        lastSnapshotRef.current = signature;
        onComputedStyles(styles, html);
        return;
      }

      if (data.type === 'axe-results') {
        const results: AxeResultsPayload = {
          violations: Array.isArray(data.violations) ? data.violations : [],
          passes: Array.isArray(data.passes) ? data.passes : [],
        };
        const signature = JSON.stringify(results);
        if (signature === lastAxeSignatureRef.current) return;
        lastAxeSignatureRef.current = signature;
        onAxeResults(results, html);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [html, onAxeResults, onComputedStyles, srcDoc]);

  // Switching viewport changes the frame width without remounting it. Ask the
  // probe for a fresh measurement right away and again after the reflow settles.
  useEffect(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage({ source: 'a11y-lens', type: 'measure' }, '*');
    const timer = window.setTimeout(() => {
      frame.postMessage({ source: 'a11y-lens', type: 'measure' }, '*');
    }, 120);
    return () => window.clearTimeout(timer);
  }, [viewport]);

  const viewportConfig = VIEWPORT_CONFIG[viewport];

  return (
    <div className="flex flex-col overflow-hidden rounded-lg bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
        <span>Isolated Preview</span>
        <div className="flex items-center gap-2">
          {issueCount !== undefined && (
            <span
              data-testid="preview-issue-badge"
              className={`rounded-full px-2 py-0.5 ${
                issueCount > 0
                  ? 'bg-rose-500/15 text-rose-200'
                  : 'bg-emerald-500/15 text-emerald-200'
              }`}
            >
              {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
            </span>
          )}
          <span
            data-testid="preview-viewport-badge"
            className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300"
          >
            {viewportConfig.label}
          </span>
        </div>
      </div>
      <div className="flex w-full overflow-x-auto bg-slate-950/60 p-4">
        {/*
          Security boundary: untrusted user HTML is inserted into srcDoc and
          executes only with `allow-scripts`. Omitting `allow-same-origin`
          gives the frame an opaque origin, so it cannot reach app DOM,
          sessionStorage, or the parent's origin. Only the source-tagged,
          source-window-checked postMessage probe is consumed.
        */}
        <iframe
          key={srcDoc}
          ref={iframeRef}
          title={title}
          data-testid="sandbox-preview-frame"
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          style={{ height: contentHeight }}
          className={`mx-auto block shrink-0 bg-white transition-all duration-200 ${viewportConfig.frameClassName}`}
        />
      </div>
    </div>
  );
}
