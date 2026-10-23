const formatter = new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 });

/** Bangladeshi taka amount, e.g. "From ৳500". */
export function Price({
  amount,
  prefix,
}: {
  amount: number;
  prefix?: string;
}) {
  return (
    <span className="font-semibold text-ink">
      {prefix && <span className="font-normal text-ink-subtle">{prefix} </span>}
      <span aria-hidden>৳{formatter.format(amount)}</span>
      <span className="sr-only">{formatter.format(amount)} taka</span>
    </span>
  );
}
