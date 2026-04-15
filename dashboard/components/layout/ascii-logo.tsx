"use client";

export function AsciiLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <pre className="text-[8px] leading-[1.1] font-mono select-none text-muted-foreground/40">
        {`  /\\_/\\
 ( o.o )
  > ^ <`}
      </pre>
    );
  }

  return (
    <pre className="text-[8px] leading-[1.15] font-mono select-none text-muted-foreground/30 whitespace-pre">
      {`██████╗██╗      █████╗ ██╗    ██╗
██╔════╝██║     ██╔══██╗██║    ██║
██║     ██║     ███████║██║ █╗ ██║
██║     ██║     ██╔══██║██║███╗██║
╚██████╗███████╗██║  ██║╚███╔███╔╝
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝`}
    </pre>
  );
}

export function AsciiDivider() {
  return (
    <div className="relative overflow-hidden h-3 flex items-center">
      <div className="text-[10px] text-muted-foreground/15 font-mono select-none text-center w-full">
        {"- ".repeat(60)}
      </div>
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

export function AsciiBorder({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="relative border border-muted-foreground/10 rounded-md font-mono">
      {title && (
        <div className="absolute -top-2.5 left-3 px-1.5 bg-background text-[10px] text-muted-foreground/40">
          {`[ ${title} ]`}
        </div>
      )}
      <div className="p-3 pt-4">{children}</div>
    </div>
  );
}
