import { CheckCircle2, RefreshCw } from 'lucide-react';

interface EmbedSuccessMessageProps {
  message: string;
  /** Optional callback to reset the form and let the user submit again. */
  onReset?: () => void;
  /** Optional reset button label. */
  resetLabel?: string;
}

export function EmbedSuccessMessage({
  message,
  onReset,
  resetLabel = 'Submit another response',
}: EmbedSuccessMessageProps) {
  return (
    <div className="forms-embed-success" role="status" aria-live="polite">
      <div className="forms-embed-success-icon">
        <CheckCircle2 size={36} strokeWidth={2} />
      </div>
      <p className="forms-embed-success-message">{message}</p>
      {onReset && (
        <button
          type="button"
          className="forms-embed-success-reset"
          onClick={onReset}
        >
          <RefreshCw size={14} strokeWidth={2} />
          <span>{resetLabel}</span>
        </button>
      )}
    </div>
  );
}
