import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, LoaderCircle, RefreshCw, Search } from 'lucide-react';

const textFrom = (node: ReactNode): string => React.Children.toArray(node).map((child) =>
  typeof child === 'string' || typeof child === 'number' ? String(child) : React.isValidElement(child) ? textFrom(child.props.children) : ''
).join('');
const slug = (node: ReactNode) => textFrom(node).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

export const HelpView: React.FC = () => {
  const [markdown, setMarkdown] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      if (!window.hermesHub?.getReadme) throw new Error('The desktop documentation bridge is unavailable.');
      setMarkdown(await window.hermesHub.getReadme());
    } catch (reason: any) {
      setError(reason?.message || 'Unable to load the bundled README.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return 0;
    return markdown.toLowerCase().split(term).length - 1;
  }, [markdown, query]);

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading the bundled handbook…</div>;
  if (error) return <div className="mx-auto max-w-2xl rounded-2xl border border-rose-500/25 bg-rose-500/10 p-6 text-sm text-rose-700 dark:text-rose-300"><p>{error}</p><button onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground"><RefreshCw className="h-4 w-4" />Retry</button></div>;

  return <div className="mx-auto max-w-5xl">
    <div className="sticky top-0 z-10 mb-6 rounded-2xl border border-border bg-background/95 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><BookOpen className="h-5 w-5" /></span><div><h1 className="text-lg font-bold">Help & README</h1><p className="text-xs text-muted-foreground">The complete handbook bundled with this version of Hermes Hub.</p></div></div>
        <label className="relative block sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find in handbook…" className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
      </div>
      {query && <p className="mt-2 text-right text-[11px] text-muted-foreground">{matches} text match{matches === 1 ? '' : 'es'} in this handbook · use Ctrl+F for browser-style highlighting</p>}
    </div>
    <article className="rounded-2xl border border-border bg-card/70 px-5 py-7 shadow-sm sm:px-9 lg:px-12">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        h1: ({ children }) => <h1 id={slug(children)} className="mb-4 border-b border-border pb-4 text-3xl font-black tracking-tight">{children}</h1>,
        h2: ({ children }) => <h2 id={slug(children)} className="mb-3 mt-10 scroll-mt-32 border-b border-border pb-2 text-xl font-bold">{children}</h2>,
        h3: ({ children }) => <h3 id={slug(children)} className="mb-2 mt-7 scroll-mt-32 text-base font-bold">{children}</h3>,
        p: ({ children }) => <p className="my-3 text-sm leading-7 text-muted-foreground">{children}</p>,
        ul: ({ children }) => <ul className="my-4 list-disc space-y-1.5 pl-6 text-sm leading-6 text-muted-foreground">{children}</ul>,
        ol: ({ children }) => <ol className="my-4 list-decimal space-y-1.5 pl-6 text-sm leading-6 text-muted-foreground">{children}</ol>,
        a: ({ href, children }) => <a href={href} target={href?.startsWith('#') ? undefined : '_blank'} rel="noreferrer" className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{children}</a>,
        blockquote: ({ children }) => <blockquote className="my-5 border-l-4 border-primary bg-primary/5 px-4 py-2">{children}</blockquote>,
        code: ({ children, className }) => className ? <code className={className}>{children}</code> : <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>,
        pre: ({ children }) => <pre className="my-4 overflow-x-auto rounded-xl border border-border bg-background p-4 font-mono text-xs leading-5 text-foreground">{children}</pre>,
        table: ({ children }) => <div className="my-5 overflow-x-auto rounded-xl border border-border"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
        th: ({ children }) => <th className="border-b border-border bg-muted/70 px-3 py-2 font-semibold">{children}</th>,
        td: ({ children }) => <td className="border-b border-border/60 px-3 py-2 align-top text-muted-foreground">{children}</td>,
        hr: () => <hr className="my-8 border-border" />,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
      }}>{markdown}</ReactMarkdown>
    </article>
  </div>;
};
