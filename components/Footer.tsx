export function Footer() {
  return (
    <footer className="py-8 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-[var(--color-text-dim)]">
          &copy; {new Date().getFullYear()} Shoumya Chowdhury. Built with Next.js.
        </p>
        <div className="flex items-center gap-6 text-sm text-[var(--color-text-dim)]">
          <a
            href="https://linkedin.com/in/shoumyachowdhury"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-text-muted)] transition-colors"
          >
            LinkedIn
          </a>
          <a
            href="https://github.com/shoumyachowdhury"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-text-muted)] transition-colors"
          >
            GitHub
          </a>
          <a
            href="mailto:shoumyachowdhury@gmail.com"
            className="hover:text-[var(--color-text-muted)] transition-colors"
          >
            Email
          </a>
        </div>
      </div>
    </footer>
  );
}
