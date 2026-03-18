import { Button } from "~/components/ui/button";
import { Link } from "react-router";

export function NavigationBarResend() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-zinc-900">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
              <div className="w-3 h-3 bg-black rounded-sm" />
            </div>
            <span className="text-white font-bold tracking-tight text-lg">GrowthFin</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">Features</a>
            <a href="#customers" className="text-sm text-zinc-400 hover:text-white transition-colors">Customers</a>
            <a href="#pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">Pricing</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/auth/sign-in" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Log in
          </Link>
          <Button variant="outline" className="bg-white text-black hover:bg-zinc-200 border-none h-9 px-4 text-sm font-medium" asChild>
            <Link to="/auth/sign-up">Sign up</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
