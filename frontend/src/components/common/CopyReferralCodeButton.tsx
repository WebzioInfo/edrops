import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

export interface CopyReferralCodeButtonProps {
  /** The referral code to copy */
  code?: string | null;
  /** Custom button CSS classes */
  className?: string;
  /** Size/classes for the Copy/Check icon */
  iconClassName?: string;
  /** Accessible label / tooltip text */
  title?: string;
  /** Optional callback fired on successful copy */
  onCopied?: (code: string) => void;
  /** Optional custom renderer for button content */
  children?: React.ReactNode | ((copied: boolean) => React.ReactNode);
}

export default function CopyReferralCodeButton({
  code,
  className = '',
  iconClassName = 'w-3 h-3',
  title = 'Copy referral code',
  onCopied,
  children,
}: CopyReferralCodeButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();

    const cleanCode = code ? String(code).trim() : '';
    if (!cleanCode) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cleanCode);
      } else {
        // Fallback for environments where clipboard API is unavailable
        const textarea = document.createElement('textarea');
        textarea.value = cleanCode;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!successful) throw new Error('execCommand failed');
      }

      setCopied(true);
      toast.success('Referral code copied!');
      if (onCopied) onCopied(cleanCode);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      toast.error('Failed to copy referral code');
    }
  };

  const isDisabled = !code || !String(code).trim();

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isDisabled}
      aria-label="Copy referral code"
      title={title}
      className={`inline-flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#1677C8] ${className}`}
    >
      {typeof children === 'function' ? (
        children(copied)
      ) : children ? (
        children
      ) : copied ? (
        <Check className={`${iconClassName} text-emerald-600 transition-transform scale-110`} />
      ) : (
        <Copy className={`${iconClassName} transition-transform hover:scale-110`} />
      )}
    </button>
  );
}
