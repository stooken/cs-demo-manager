import React from 'react';

export const fieldClassName =
  'w-full appearance-none rounded-4 border border-gray-400 bg-gray-50 px-8 py-4 text-gray-900 focus:border-blue-500';
export function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="flex flex-col gap-4 text-caption text-gray-700">
      {label}
      {multiline ? (
        <textarea
          aria-label={label}
          className={fieldClassName}
          rows={3}
          value={value}
          maxLength={16000}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          aria-label={label}
          className={fieldClassName}
          value={value}
          maxLength={160}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
