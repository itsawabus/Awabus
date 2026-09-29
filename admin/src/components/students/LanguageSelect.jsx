import { Label, Select } from '../ui/Input.jsx';
import { DEFAULT_LANGUAGE, VOICE_LANGUAGES } from '../../lib/languages.js';

/** Parent's language for automated calls and the phone line. Blank means English. */
export default function LanguageSelect({ value, onChange, id = 'guardian-language' }) {
  return (
    <div>
      <Label htmlFor={id}>Preferred language for calls</Label>
      <Select id={id} value={value || DEFAULT_LANGUAGE} onChange={(e) => onChange(e.target.value)}>
        {VOICE_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
            {l.code === DEFAULT_LANGUAGE ? ' (default)' : ''}
          </option>
        ))}
      </Select>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Used for automated voice calls to this parent and when they call the AwaBus line.
      </p>
    </div>
  );
}
