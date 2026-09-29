import { CheckCircle2 } from 'lucide-react';
import Input from './Input.jsx';
import { LICENSE_MAX_LENGTH, LICENSE_RE, PLATE_MAX_LENGTH, PLATE_RE, formatLicense, formatPlate } from '../../lib/formats.js';

// A field typed through a mask (like the GPS address): the value is cleaned as
// it is typed, and the line under it says what is still missing or confirms
// the format once complete. `error` (from the form's own checks) wins.
function MaskedInput({ value, onChange, format, isComplete, hint, doneText, error, ...props }) {
  const done = isComplete(value || '');
  return (
    <div>
      <Input
        value={value}
        onChange={(e) => onChange(format(e.target.value))}
        error={Boolean(error)}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        {...props}
      />
      {!error &&
        (done ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {doneText}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-slate-400">{typeof hint === 'function' ? hint(value || '') : hint}</p>
        ))}
    </div>
  );
}

// What to type next in a plate, from what is there so far.
const plateHint = (v) => {
  if (!v) return 'Region letters, number, then year or letter, e.g. GR-1234-20. The dashes are added for you.';
  const [, number, end] = v.split('-');
  if (number === undefined) return 'Now the number (the dash is added when you type it)';
  if (end === undefined) return 'Now the number, up to 4 digits, then the year or series letter';
  return 'Now the 2-digit year (e.g. 20) or the series letter (e.g. Z)';
};

export function PlateInput(props) {
  return (
    <MaskedInput
      format={formatPlate}
      isComplete={(v) => PLATE_RE.test(v)}
      hint={plateHint}
      doneText="Plate format is correct"
      placeholder="GR-1234-20"
      maxLength={PLATE_MAX_LENGTH}
      pattern="[A-Z]{1,3}-[0-9]{1,4}-([0-9]{2}|[A-Z])"
      title="Plate number, e.g. GR-1234-20"
      {...props}
    />
  );
}

export function LicenseInput(props) {
  return (
    <MaskedInput
      format={formatLicense}
      isComplete={(v) => v.length >= 6 && LICENSE_RE.test(v)}
      hint={(v) =>
        v && v.length < 6
          ? `At least 6 characters (${v.length} so far)`
          : 'Capital letters and numbers as printed on the license, e.g. GH-DL-29831'
      }
      doneText="License number format is correct"
      placeholder="GH-DL-29831"
      maxLength={LICENSE_MAX_LENGTH}
      title="License number, e.g. GH-DL-29831"
      {...props}
    />
  );
}
