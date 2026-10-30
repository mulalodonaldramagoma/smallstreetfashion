import { useState, useRef, useEffect } from 'react';
import { Share2, MessageCircle, Facebook, Link as LinkIcon, Check, X, MoreHorizontal } from 'lucide-react';

interface ShareButtonProps {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  className?: string;
}

export function ShareButton({ title, description, url, image, className }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const shareText = `${title} — ${description}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);
  const encodedImage = image ? encodeURIComponent(image) : '';

  const handleWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n\n${url}`)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const handleFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const handleMoreApps = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: shareText,
          url,
        });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          // Sharing failed for a non-cancellation reason — fall back to copy
          handleCopyLink();
          return;
        }
        // User cancelled — do nothing
      }
      setOpen(false);
    } else {
      // Native share unavailable — fall back to copying the link
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setCopyError(false);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 2000);
    } catch {
      setCopyError(true);
      setCopied(false);
      setTimeout(() => setCopyError(false), 3000);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={className || "flex items-center gap-2 px-4 py-2.5 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"}
        aria-label="Share"
      >
        <Share2 size={16} /> Share
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-white border border-neutral-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Share via</span>
            <button onClick={() => setOpen(false)} className="p-0.5 text-neutral-400 hover:text-neutral-900">
              <X size={14} />
            </button>
          </div>
          <div className="p-2">
            <button
              onClick={handleMoreApps}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <MoreHorizontal size={18} className="text-neutral-500" /> More apps…
            </button>
            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <MessageCircle size={18} className="text-green-600" /> WhatsApp
            </button>
            <button
              onClick={handleFacebook}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Facebook size={18} className="text-blue-600" /> Facebook
            </button>
            <div className="border-t border-neutral-100 my-1" />
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={18} className="text-green-600" />
                  <span className="text-green-600">Link copied!</span>
                </>
              ) : copyError ? (
                <>
                  <X size={18} className="text-rose-600" />
                  <span className="text-rose-600">Failed to copy</span>
                </>
              ) : (
                <>
                  <LinkIcon size={18} className="text-neutral-500" /> Copy Link
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
