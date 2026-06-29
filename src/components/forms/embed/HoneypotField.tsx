// Honeypot anti-bot field.
//
// Visually hidden, ignored by screen readers, non-focusable, autocomplete off.
// Bots tend to fill every input; humans never see this. A non-empty value on
// submit flips the submission to spam (see FormRenderer + submissionService).

interface HoneypotFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Input name — deliberately non-obvious so bots fill it. */
  name?: string;
  /** Field id used for the label/aria wiring. */
  id?: string;
}

export function HoneypotField({
  value,
  onChange,
  name = 'website_url_hp',
  id = 'tabs-form-website-url-hp',
}: HoneypotFieldProps) {
  return (
    <div className="forms-embed-honeypot" aria-hidden="true">
      <label htmlFor={id}>
        Website URL <span className="forms-embed-hp-optional">(leave empty)</span>
      </label>
      <input
        id={id}
        type="text"
        name={name}
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
