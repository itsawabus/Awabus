import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { resizeImage } from '../../lib/image.js';

/** Profile photo picker: resizes the chosen image and shows a preview with a remove button. */
export default function PhotoUpload({ value, onChange }) {
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again (e.g. after removing it) still fires.
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      onChange(await resizeImage(file));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="relative">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center hover:border-brand-300 dark:border-slate-700 dark:bg-navy">
        {value ? (
          <img src={value} alt="Preview" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <Upload className="h-6 w-6 text-slate-400" />
        )}
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {value ? 'Click to change photo' : 'Click to upload profile photo'}
        </span>
        <span className="text-xs text-slate-400">PNG or JPG — resized automatically</span>
        {error && <span className="text-xs font-medium text-red-500">{error}</span>}
        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFile} />
      </label>
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            setError('');
          }}
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50 dark:border-slate-700 dark:bg-navy-light dark:hover:bg-red-950/40"
          aria-label="Remove photo"
        >
          <X className="h-3.5 w-3.5" />
          Remove
        </button>
      )}
    </div>
  );
}
