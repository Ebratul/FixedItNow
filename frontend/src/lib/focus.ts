/** Move focus to the first invalid control after a failed submit. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
