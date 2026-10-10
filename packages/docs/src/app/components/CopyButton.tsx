'use client';

import { useEffect, useRef, useState } from 'react';
import { FaCheck, FaCopy } from 'react-icons/fa';

interface CopyButtonParams {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CopyButton({ text, className, style }: CopyButtonParams) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function handleCopy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
    timer.current = setTimeout(() => setStatus('idle'), 2000);
  }

  const label =
    status === 'copied'
      ? 'Copied'
      : status === 'error'
        ? 'Copy failed. Select the text to copy.'
        : 'Copy code';
  return (
    <div className={className} style={style}>
      <button
        type="button"
        onClick={handleCopy}
        className="copy-btn"
        title={label}
        aria-label={label}
      >
        {status === 'copied' ? (
          <FaCheck className="copy-btn-icon copy-btn-check" />
        ) : (
          <FaCopy className="copy-btn-icon" />
        )}
      </button>
      <span className="copy-announcement" role="status">
        {status === 'idle' ? '' : label}
      </span>
    </div>
  );
}
