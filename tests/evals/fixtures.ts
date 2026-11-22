export interface EvalFixture {
  id: string;
  name: string;
  html: string;
  expectedRuleId: string;
}

/**
 * Small, deterministic fixtures for the zero-key demo fixer. Each fixture must
 * contain the expected violation before the fix and no longer contain it after.
 */
export const EVAL_FIXTURES: EvalFixture[] = [
  {
    id: 'image-alt',
    name: 'missing image alt text',
    html: '<img src="hero.png" class="w-full rounded-lg">',
    expectedRuleId: 'image-alt',
  },
  {
    id: 'button-name',
    name: 'icon-only button',
    html: '<button class="rounded bg-indigo-600 p-2"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"></path></svg></button>',
    expectedRuleId: 'accessible-name',
  },
  {
    id: 'form-label',
    name: 'unlabelled email input',
    html: '<input id="email" type="email" placeholder="Email address" class="border p-2">',
    expectedRuleId: 'form-label',
  },
  {
    id: 'heading-order',
    name: 'skipped heading level',
    html: '<h1>Account settings</h1><h4>Notifications</h4>',
    expectedRuleId: 'heading-order',
  },
  {
    id: 'vague-link',
    name: 'vague link text',
    html: '<h2>Pricing plans</h2><a href="/pricing">Learn more</a>',
    expectedRuleId: 'vague-link-text',
  },
  {
    id: 'positive-tabindex',
    name: 'positive tabindex',
    html: '<div tabindex="4">Keyboard trap candidate</div>',
    expectedRuleId: 'positive-tabindex',
  },
  {
    id: 'focus-outline',
    name: 'suppressed focus outline',
    html: '<button class="outline-none rounded bg-slate-900 px-4 py-2 text-white">Save</button>',
    expectedRuleId: 'focus-outline',
  },
  {
    id: 'contrast',
    name: 'low-contrast inline text',
    html: '<p style="color:#999;background-color:#fff">Low contrast paragraph</p>',
    expectedRuleId: 'color-contrast',
  },
];
