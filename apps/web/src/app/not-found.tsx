import { LogoMark } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <div className="flex h-20 w-20 animate-rise items-center justify-center rounded-3xl bg-accent-soft">
        <LogoMark className="h-12 w-12 -rotate-12" />
      </div>
      <p className="mt-6 text-sm font-semibold tracking-wide text-accent-strong uppercase">404</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">This page came unclasped.</h1>
      <p className="mt-3 text-ink-2">
        We couldn’t find what you were looking for. If you followed a link to a coin, it may not have a Clasp vault yet.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/coins" variant="secondary">
          Browse coins
        </ButtonLink>
      </div>
    </div>
  );
}
