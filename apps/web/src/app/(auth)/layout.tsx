export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-primary mb-2">ExeTeam</div>
          <p className="text-muted-foreground text-sm">Gestion de Bureau d&apos;Étude</p>
        </div>
        {children}
      </div>
    </div>
  );
}
