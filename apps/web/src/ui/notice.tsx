import { type ReactNode, useState } from 'react';
import { useT } from '../i18n';
import { Button } from './button';
import { CheckIcon, CopyIcon } from './icons';

function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  // Without the Clipboard API the secret stays selectable in one click (user-select: all).
  if (!navigator.clipboard) return null;
  const copy = () =>
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  return (
    <Button onClick={copy} className="max-sm:w-full">
      <CopyIcon />
      {copied ? t('copy.copied') : t('copy.copy')}
    </Button>
  );
}

/** A secret shown once (API key, invitation or reset link), with its copy button. */
export function SecretNotice({ message, secret }: { message: ReactNode; secret: string }) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg border border-success p-4">
      <p className="m-0 flex items-start gap-3 text-ink">
        <CheckIcon className="mt-px flex-none text-success" />
        <span>{message}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-[1_1_320px] rounded-control border border-line bg-page px-3 py-2.5 font-mono text-[13px] leading-5 break-all text-ink select-all">
          {secret}
        </code>
        <CopyButton text={secret} />
      </div>
    </div>
  );
}
