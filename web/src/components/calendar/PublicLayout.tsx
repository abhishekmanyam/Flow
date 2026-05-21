import { Separator } from "@/components/ui/separator";

interface PublicLayoutProps {
  children: React.ReactNode;
  workspaceName?: string;
}

export default function PublicLayout({
  children,
  workspaceName,
}: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <img
            src="/logo.png"
            alt={workspaceName ?? ""}
            className="h-8 sm:h-9 w-auto object-contain"
          />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <Separator className="mb-6" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Powered by FlowTask</span>
            {workspaceName && <span>{workspaceName}</span>}
          </div>
        </div>
      </footer>
    </div>
  );
}
