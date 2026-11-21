export type SnippetLanguage = 'html-tailwind';

export interface CodeSnippet {
  id: string;
  name: string;
  language: SnippetLanguage;
  html: string;
  createdAt: string;
  updatedAt: string;
}
