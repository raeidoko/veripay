import React, { useEffect, useId, useState } from 'react';
import { MAX_PRODUCT_IMAGE_BYTES, PRODUCT_IMAGE_TYPES } from '../shared/productImages.ts';

export function ProductImagePicker({ file, onChange, disabled = false }: {
  file: File | null; onChange: (file: File | null) => void; disabled?: boolean;
}) {
  const id = useId();
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return <div className="space-y-2">
    <label htmlFor={id} className="block text-xs font-semibold text-slate-700">Product image</label>
    <input id={id} type="file" accept={PRODUCT_IMAGE_TYPES.join(',')} disabled={disabled}
      aria-describedby={`${id}-help`} className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand-700"
      onChange={event => {
        const selected = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!selected) return;
        setError('');
        if (!PRODUCT_IMAGE_TYPES.includes(selected.type)) { setError('Choose a JPG, PNG, or WebP image.'); return; }
        if (selected.size > MAX_PRODUCT_IMAGE_BYTES) { setError('Images must be 5 MB or smaller.'); return; }
        if (!selected.size) { setError('This file is empty. Choose another image.'); return; }
        onChange(selected);
      }} />
    <p id={`${id}-help`} className="text-[11px] text-slate-500">JPG, PNG, or WebP · Maximum 5 MB</p>
    {preview && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <img src={preview} alt="Product image preview" className="h-40 w-full rounded-lg object-contain"
        onError={() => { setError('This image could not be opened. Choose another file.'); onChange(null); }} />
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-slate-500">{file?.name}</span>
        <button type="button" disabled={disabled} onClick={() => { onChange(null); setError(''); }} className="shrink-0 font-semibold text-rose-600">Remove image</button>
      </div>
    </div>}
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
  </div>;
}
