export function BrandLogo({ size = 'header' }: { size?: 'header' | 'signin' | 'footer' }) {
  const sizes = { header: 'h-16 w-16', signin: 'mx-auto h-24 w-24 md:mx-0 md:h-28 md:w-28', footer: 'h-12 w-12' };
  return <img src="/brand/veripay-logo.png" alt="VeriPay — Verify, Connect, Pay" width={512} height={512}
    className={`${sizes[size]} shrink-0 rounded-xl object-contain`} decoding="async" />;
}
