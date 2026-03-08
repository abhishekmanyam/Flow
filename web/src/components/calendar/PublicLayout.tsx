import { CalendarDays } from "lucide-react";
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
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-primary-foreground" />
            </div>
            {workspaceName && (
              <span className="font-semibold text-sm truncate">
                {workspaceName}
              </span>
            )}
          </div>
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
